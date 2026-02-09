import { AudioInspectError, type WindowFunction } from '../../types.js';

export type WindowType =
  | 'rectangular'
  | 'hann'
  | 'hamming'
  | 'blackman'
  | 'bartlett'
  | 'kaiser'
  | 'tukey'
  | 'none';

export interface WindowParameters {
  kaiserBeta?: number;
  tukeyAlpha?: number;
}

export interface WindowCache {
  getOrCreate(length: number, type: WindowType, params?: WindowParameters): Float32Array;
  clear(): void;
}

function normalizeWindowType(type: WindowType | WindowFunction): Exclude<WindowType, 'none'> {
  return type === 'none' ? 'rectangular' : type;
}

function createWindowKey(length: number, type: Exclude<WindowType, 'none'>, params?: WindowParameters): string {
  const beta = params?.kaiserBeta ?? 8.6;
  const alpha = params?.tukeyAlpha ?? 0.5;
  return `${type}|${length}|${beta}|${alpha}`;
}

function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  const x2 = (x * x) / 4;

  for (let k = 1; k < 50; k++) {
    term *= x2 / (k * k);
    sum += term;
    if (term < 1e-10 * sum) {
      break;
    }
  }

  return sum;
}

function createWindow(length: number, type: Exclude<WindowType, 'none'>, params?: WindowParameters): Float32Array {
  if (!Number.isInteger(length) || length < 0) {
    throw new AudioInspectError('INVALID_INPUT', `Invalid window length: ${length}`);
  }

  if (length === 0) {
    return new Float32Array(0);
  }

  const window = new Float32Array(length);
  if (length === 1 || type === 'rectangular') {
    window.fill(1);
    return window;
  }

  switch (type) {
    case 'hann': {
      for (let i = 0; i < length; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
      }
      return window;
    }
    case 'hamming': {
      for (let i = 0; i < length; i++) {
        window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1));
      }
      return window;
    }
    case 'blackman': {
      for (let i = 0; i < length; i++) {
        window[i] =
          0.42 -
          0.5 * Math.cos((2 * Math.PI * i) / (length - 1)) +
          0.08 * Math.cos((4 * Math.PI * i) / (length - 1));
      }
      return window;
    }
    case 'bartlett': {
      for (let i = 0; i < length; i++) {
        window[i] = 1 - Math.abs((i - (length - 1) / 2) / ((length - 1) / 2));
      }
      return window;
    }
    case 'kaiser': {
      const beta = params?.kaiserBeta ?? 8.6;
      const denom = besselI0(beta);
      for (let i = 0; i < length; i++) {
        const x = (2 * i) / (length - 1) - 1;
        window[i] = besselI0(beta * Math.sqrt(1 - x * x)) / denom;
      }
      return window;
    }
    case 'tukey': {
      const alpha = params?.tukeyAlpha ?? 0.5;
      if (alpha <= 0) {
        window.fill(1);
        return window;
      }
      if (alpha >= 1) {
        for (let i = 0; i < length; i++) {
          window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
        }
        return window;
      }

      const edge = (alpha * (length - 1)) / 2;
      for (let i = 0; i < length; i++) {
        if (i < edge) {
          window[i] = 0.5 * (1 + Math.cos(Math.PI * ((2 * i) / (alpha * (length - 1)) - 1)));
        } else if (i <= (length - 1) * (1 - alpha / 2)) {
          window[i] = 1;
        } else {
          window[i] =
            0.5 * (1 + Math.cos(Math.PI * ((2 * i) / (alpha * (length - 1)) - 2 / alpha + 1)));
        }
      }
      return window;
    }
    default:
      throw new AudioInspectError('INVALID_INPUT', `Unknown window type: ${String(type)}`);
  }
}

export class WindowCacheStore implements WindowCache {
  private readonly cache = new Map<string, Float32Array>();

  getOrCreate(length: number, type: WindowType, params?: WindowParameters): Float32Array {
    const normalizedType = normalizeWindowType(type);
    const key = createWindowKey(length, normalizedType, params);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const created = createWindow(length, normalizedType, params);
    this.cache.set(key, created);
    return created;
  }

  clear(): void {
    this.cache.clear();
  }
}

const sharedWindowCache = new WindowCacheStore();

export function getWindow(length: number, type: WindowType, params?: WindowParameters): Float32Array {
  return sharedWindowCache.getOrCreate(length, type, params);
}

export function clearWindowCache(): void {
  sharedWindowCache.clear();
}

export function applyWindowInto(
  source: Float32Array,
  target: Float32Array,
  window: Float32Array
): Float32Array {
  if (source.length !== target.length || source.length !== window.length) {
    throw new AudioInspectError('INVALID_INPUT', 'source/target/window lengths must match');
  }

  for (let i = 0; i < source.length; i++) {
    target[i] = source[i]! * window[i]!;
  }
  return target;
}

export interface FillWindowedFrameRequest {
  src: Float32Array;
  srcStart: number;
  frameLength: number;
  dst: Float32Array;
  windowType: WindowType;
  windowParams?: WindowParameters;
  cache?: WindowCache;
}

export function fillWindowedFrameInto(request: FillWindowedFrameRequest): Float32Array {
  const {
    src,
    srcStart,
    frameLength,
    dst,
    windowType,
    windowParams,
    cache = sharedWindowCache
  } = request;
  dst.fill(0);

  if (dst.length === 0 || frameLength <= 0 || srcStart >= src.length) {
    return dst;
  }

  const start = Math.max(0, srcStart);
  const validFrameLength = Math.min(frameLength, dst.length);
  const available = Math.max(0, Math.min(validFrameLength, src.length - start));
  if (available === 0) {
    return dst;
  }

  const normalizedType = normalizeWindowType(windowType);
  if (normalizedType === 'rectangular' || validFrameLength === 1) {
    dst.set(src.subarray(start, start + available), 0);
    return dst;
  }

  const window = cache.getOrCreate(validFrameLength, normalizedType, windowParams);
  for (let i = 0; i < available; i++) {
    dst[i] = src[start + i]! * window[i]!;
  }
  return dst;
}

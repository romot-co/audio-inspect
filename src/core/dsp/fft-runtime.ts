import { AudioInspectError } from '../../types.js';
import {
  FFTProviderFactory,
  type FFTProviderConfig,
  type FFTProviderType,
  type IFFTProvider
} from './fft-provider.js';

export interface FFTProviderResolver {
  createProvider(config: FFTProviderConfig): Promise<IFFTProvider>;
}

export interface FFTProviderRequest {
  fftSize: number;
  sampleRate: number;
  provider?: FFTProviderType;
  enableProfiling?: boolean;
  fallbackToNative?: boolean;
  resolver?: FFTProviderResolver;
}

export interface FFTProviderCache {
  getOrCreate(request: FFTProviderRequest): Promise<IFFTProvider>;
  clear(): void;
}

export interface FFTProviderHandle {
  provider: IFFTProvider;
  release: () => void;
}

function createRequestKey(request: FFTProviderRequest): string {
  const provider = request.provider ?? 'native';
  const enableProfiling = request.enableProfiling ? 1 : 0;
  const fallbackToNative = request.fallbackToNative ? 1 : 0;
  return `${provider}|${request.fftSize}|${request.sampleRate}|${enableProfiling}|${fallbackToNative}`;
}

export class FFTProviderCacheStore implements FFTProviderCache {
  private providers = new Map<string, IFFTProvider>();

  async getOrCreate(request: FFTProviderRequest): Promise<IFFTProvider> {
    const key = createRequestKey(request);
    const existing = this.providers.get(key);
    if (existing) {
      return existing;
    }

    const provider = await createFFTProvider(request);
    this.providers.set(key, provider);
    return provider;
  }

  clear(): void {
    for (const provider of this.providers.values()) {
      provider.dispose();
    }
    this.providers.clear();
  }
}

const sharedFFTProviderCache = new FFTProviderCacheStore();

export async function acquireFFTProvider(
  request: FFTProviderRequest & {
    cache?: FFTProviderCache | undefined;
    useSharedCache?: boolean;
  }
): Promise<FFTProviderHandle> {
  const { cache, useSharedCache = false, ...providerRequest } = request;
  const effectiveCache = cache ?? (useSharedCache ? sharedFFTProviderCache : undefined);

  if (effectiveCache) {
    const provider = await effectiveCache.getOrCreate(providerRequest);
    return {
      provider,
      release: () => {
        // cache lifecycle is controlled by cache owner
      }
    };
  }

  const provider = await createFFTProvider(providerRequest);
  return {
    provider,
    release: () => {
      provider.dispose();
    }
  };
}

export async function createFFTProvider(request: FFTProviderRequest): Promise<IFFTProvider> {
  const {
    fftSize,
    sampleRate,
    provider = 'native',
    enableProfiling = false,
    fallbackToNative = provider === 'webfft',
    resolver = FFTProviderFactory
  } = request;

  const candidates: FFTProviderType[] =
    fallbackToNative && provider !== 'native' ? [provider, 'native'] : [provider];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await resolver.createProvider({
        type: candidate,
        fftSize,
        sampleRate,
        enableProfiling
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw new AudioInspectError('INITIALIZATION_FAILED', 'Failed to create FFT provider', lastError);
}

export function clearSharedFFTProviderCache(): void {
  sharedFFTProviderCache.clear();
}

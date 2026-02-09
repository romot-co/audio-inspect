import { AudioData, AudioInspectError } from '../types.js';
import {
  type FFTProviderType,
  type FFTResult,
  type IFFTProvider
} from '../core/dsp/fft-provider.js';
import { acquireFFTProvider, type FFTProviderCache } from '../core/dsp/fft-runtime.js';
import { fillWindowedFrameInto } from '../core/dsp/window.js';
import { ampToDb, powToDb } from '../core/dsp/db.js';
import { nextPowerOfTwo } from '../core/utils.js';

// Stereo analysis options for channel correlation and spatial metrics.
export interface StereoAnalysisOptions {
  frameSize?: number;
  hopSize?: number;
  calculatePhase?: boolean;
  calculateITD?: boolean;
  calculateILD?: boolean;
  provider?: FFTProviderType;
  enableProfiling?: boolean;
  providerCache?: FFTProviderCache | undefined;
}

export interface StereoAnalysisResult {
  correlation: number;
  coherence?: Float32Array;
  width: number;
  widthFrequency?: Float32Array;
  balance: number;
  phaseDifference?: number;
  phaseCorrelation?: number;
  midSideRatio: number;
  itd?: number;
  ild?: number;
  goniometer?: {
    x: Float32Array; // L-R (Side)
    y: Float32Array; // L+R (Mid)
  };
}

interface StereoMetrics {
  correlation: number;
  width: number;
  balance: number;
  midSideRatio: number;
  energyL: number;
  energyR: number;
  mid: Float32Array | undefined;
  side: Float32Array | undefined;
}

// Window and FFT a stereo channel frame.
async function computeStereoFFT(
  data: Float32Array,
  start: number,
  fftSize: number,
  fftProvider: IFFTProvider,
  frameBuffer?: Float32Array
): Promise<FFTResult> {
  const frame = frameBuffer ?? new Float32Array(fftSize);
  fillWindowedFrameInto({
    src: data,
    srcStart: start,
    frameLength: Math.min(fftSize, Math.max(0, data.length - start)),
    dst: frame,
    windowType: 'hann'
  });
  return fftProvider.fft(frame);
}

// Estimate inter-channel sample delay by cross-correlation search.
function estimateDelay(
  left: Float32Array,
  right: Float32Array,
  maxDelaySamples: number = 44
): number {
  const len = Math.min(left.length, right.length);
  let maxCorr = -Infinity;
  let bestDelay = 0;

  for (let delay = -maxDelaySamples; delay <= maxDelaySamples; delay++) {
    let correlation = 0;
    let count = 0;

    for (let i = 0; i < len; i++) {
      const rightIdx = i + delay;
      if (rightIdx >= 0 && rightIdx < len) {
        const leftSample = left[i]!;
        const rightSample = right[rightIdx]!;
        correlation += leftSample * rightSample;
        count++;
      }
    }

    if (count > 0) {
      correlation /= count;
      if (correlation > maxCorr) {
        maxCorr = correlation;
        bestDelay = delay;
      }
    }
  }

  return bestDelay;
}

// Core stereo-domain metrics computed from paired channels.
function calculateStereoMetrics(
  left: Float32Array,
  right: Float32Array,
  includeGoniometer: boolean
): StereoMetrics {
  const len = Math.min(left.length, right.length);
  const mid = includeGoniometer ? new Float32Array(len) : undefined;
  const side = includeGoniometer ? new Float32Array(len) : undefined;

  if (len === 0) {
    return {
      correlation: 0,
      width: 0,
      balance: 0,
      midSideRatio: 0,
      energyL: 0,
      energyR: 0,
      mid,
      side
    };
  }

  let sumL = 0;
  let sumR = 0;
  let sumLR = 0;
  let sumL2 = 0;
  let sumR2 = 0;
  let energyL = 0;
  let energyR = 0;
  let energyMid = 0;
  let energySide = 0;

  for (let i = 0; i < len; i++) {
    const l = left[i]!;
    const r = right[i]!;

    sumL += l;
    sumR += r;
    sumLR += l * r;
    sumL2 += l * l;
    sumR2 += r * r;
    energyL += l * l;
    energyR += r * r;

    const midVal = (l + r) * 0.5;
    const sideVal = (l - r) * 0.5;
    energyMid += midVal * midVal;
    energySide += sideVal * sideVal;

    if (mid && side) {
      mid[i] = midVal;
      side[i] = sideVal;
    }
  }

  const meanL = sumL / len;
  const meanR = sumR / len;
  const covariance = sumLR / len - meanL * meanR;
  const stdL = Math.sqrt(Math.max(0, sumL2 / len - meanL * meanL));
  const stdR = Math.sqrt(Math.max(0, sumR2 / len - meanR * meanR));
  const rawCorrelation = stdL > 1e-10 && stdR > 1e-10 ? covariance / (stdL * stdR) : 0;
  const correlation = Math.max(-1, Math.min(1, rawCorrelation));
  const width = energyMid + energySide > 1e-10 ? energySide / (energyMid + energySide) : 0;
  const balance = energyL + energyR > 1e-10 ? (energyR - energyL) / (energyL + energyR) : 0;
  const midSideRatio =
    energySide > 1e-10 ? powToDb(energyMid / energySide, 1) : energyMid > 1e-10 ? Infinity : 0;

  return {
    correlation,
    width,
    balance,
    midSideRatio,
    energyL,
    energyR,
    mid,
    side
  };
}

// Magnitude-squared coherence estimated from frame-averaged spectra.
async function calculateCoherenceMSC(
  left: Float32Array,
  right: Float32Array,
  fftSize: number,
  hopSize: number,
  fftProvider: IFFTProvider
): Promise<Float32Array> {
  const len = Math.min(left.length, right.length);
  const bins = Math.floor(fftSize / 2) + 1;
  const crossReal = new Float32Array(bins);
  const crossImag = new Float32Array(bins);
  const autoLeft = new Float32Array(bins);
  const autoRight = new Float32Array(bins);
  const leftFrame = new Float32Array(fftSize);
  const rightFrame = new Float32Array(fftSize);

  let frameCount = 0;
  let start = 0;
  while (start < len || frameCount === 0) {
    const end = Math.min(start + fftSize, len);

    const [leftFFT, rightFFT] = await Promise.all([
      computeStereoFFT(left, start, fftSize, fftProvider, leftFrame),
      computeStereoFFT(right, start, fftSize, fftProvider, rightFrame)
    ]);

    for (let i = 0; i < bins; i++) {
      const lReal = leftFFT.complex[i * 2] ?? 0;
      const lImag = leftFFT.complex[i * 2 + 1] ?? 0;
      const rReal = rightFFT.complex[i * 2] ?? 0;
      const rImag = rightFFT.complex[i * 2 + 1] ?? 0;

      // Sxy = X * conj(Y)
      crossReal[i] = crossReal[i]! + lReal * rReal + lImag * rImag;
      crossImag[i] = crossImag[i]! + lImag * rReal - lReal * rImag;
      autoLeft[i] = autoLeft[i]! + lReal * lReal + lImag * lImag;
      autoRight[i] = autoRight[i]! + rReal * rReal + rImag * rImag;
    }

    frameCount++;
    if (end >= len) {
      break;
    }
    start += hopSize;
  }

  const coherence = new Float32Array(bins);
  let maxDenominator = 0;
  for (let i = 0; i < bins; i++) {
    const denominator = autoLeft[i]! * autoRight[i]!;
    if (denominator > maxDenominator) {
      maxDenominator = denominator;
    }
  }
  const silenceThreshold = Math.max(1e-10, maxDenominator * 1e-4);
  const autoSilenceThreshold = Math.sqrt(silenceThreshold);

  for (let i = 0; i < bins; i++) {
    const denominator = autoLeft[i]! * autoRight[i]!;
    const numerator = crossReal[i]! ** 2 + crossImag[i]! ** 2;
    if (denominator <= silenceThreshold) {
      const leftSilent = Math.abs(autoLeft[i] ?? 0) <= autoSilenceThreshold;
      const rightSilent = Math.abs(autoRight[i] ?? 0) <= autoSilenceThreshold;
      coherence[i] = leftSilent && rightSilent ? 1 : 0;
      continue;
    }

    const value = numerator / denominator;
    coherence[i] = Math.min(1, Math.max(0, value));
  }

  return coherence;
}

// Estimate width per frequency bin from phase and magnitude asymmetry.
function calculateFrequencyWidth(
  leftMag: Float32Array,
  rightMag: Float32Array,
  leftPhase: Float32Array,
  rightPhase: Float32Array
): Float32Array {
  const width = new Float32Array(leftMag.length);

  for (let i = 0; i < width.length; i++) {
    const lMag = leftMag[i]!;
    const rMag = rightMag[i]!;
    const lPhase = leftPhase[i]!;
    const rPhase = rightPhase[i]!;
    const phaseDiff = lPhase - rPhase;

    const midMag = Math.abs(lMag + rMag) / 2;
    const sideMag = Math.abs(lMag - rMag) / 2;

    const phaseWidth = Math.abs(Math.sin(phaseDiff / 2));
    const magWidth = sideMag / (midMag + sideMag + 1e-10);

    width[i] = Math.max(magWidth, phaseWidth);
  }

  return width;
}

// Compute stereo metrics for a whole clip.
export async function getStereoAnalysis(
  audio: AudioData,
  options: StereoAnalysisOptions = {}
): Promise<StereoAnalysisResult> {
  if (audio.numberOfChannels < 2) {
    throw new AudioInspectError(
      'INVALID_INPUT',
      'Stereo analysis requires audio with at least two channels'
    );
  }

  const {
    frameSize = Math.min(8192, audio.length),
    calculatePhase = false,
    calculateITD = false,
    calculateILD = false,
    provider = 'native',
    enableProfiling = false,
    providerCache
  } = options;

  const left = audio.channelData[0];
  const right = audio.channelData[1];
  if (!left || !right) {
    throw new AudioInspectError('INVALID_INPUT', 'L/R channel data is missing');
  }

  const len = Math.min(left.length, right.length);
  if (len === 0) {
    return {
      correlation: 0,
      width: 0,
      balance: 0,
      midSideRatio: 0
    };
  }

  const metrics = calculateStereoMetrics(left, right, true);
  const result: StereoAnalysisResult = {
    correlation: metrics.correlation,
    width: metrics.width,
    balance: metrics.balance,
    midSideRatio: metrics.midSideRatio
  };
  if (metrics.side && metrics.mid) {
    result.goniometer = {
      x: metrics.side,
      y: metrics.mid
    };
  }

  // Optional frequency-domain phase and coherence analysis.
  if (calculatePhase) {
    const actualFrameSize = Math.max(32, Math.min(frameSize, len));
    const fftSize = nextPowerOfTwo(actualFrameSize);
    const phaseHopSize = Math.max(1, Math.floor(actualFrameSize / 2));
    const { provider: fftProvider, release } = await acquireFFTProvider({
      fftSize,
      sampleRate: audio.sampleRate,
      provider,
      enableProfiling,
      fallbackToNative: provider === 'webfft',
      cache: providerCache
    });

    try {
      const [leftFFT, rightFFT] = await Promise.all([
        computeStereoFFT(left.subarray(0, actualFrameSize), 0, fftSize, fftProvider),
        computeStereoFFT(right.subarray(0, actualFrameSize), 0, fftSize, fftProvider)
      ]);

      result.coherence = await calculateCoherenceMSC(
        left.subarray(0, len),
        right.subarray(0, len),
        fftSize,
        phaseHopSize,
        fftProvider
      );
      result.widthFrequency = calculateFrequencyWidth(
        leftFFT.magnitude,
        rightFFT.magnitude,
        leftFFT.phase,
        rightFFT.phase
      );

      let phaseDiffSum = 0;
      let phaseCorrSum = 0;
      let weightSum = 0;

      for (let i = 1; i < leftFFT.phase.length; i++) {
        // Weight phase stats by the joint magnitude of both channels.
        const leftMag = leftFFT.magnitude[i]!;
        const rightMag = rightFFT.magnitude[i]!;
        const weight = leftMag * rightMag;
        if (weight <= 0) continue;

        const phaseDiff =
          ((leftFFT.phase[i]! - rightFFT.phase[i]! + Math.PI) % (2 * Math.PI)) - Math.PI;

        phaseDiffSum += phaseDiff * weight;
        phaseCorrSum += Math.cos(phaseDiff) * weight;
        weightSum += weight;
      }

      result.phaseDifference = weightSum > 1e-10 ? ((phaseDiffSum / weightSum) * 180) / Math.PI : 0;
      result.phaseCorrelation = weightSum > 1e-10 ? phaseCorrSum / weightSum : 0;
    } finally {
      release();
    }
  }

  // Interaural time difference (ms), estimated via small-delay search.
  if (calculateITD) {
    const maxDelay = Math.max(1, Math.round(audio.sampleRate * 0.001));
    const delaySamples = estimateDelay(
      left.subarray(0, Math.min(frameSize, len)),
      right.subarray(0, Math.min(frameSize, len)),
      maxDelay
    );
    result.itd = (delaySamples / audio.sampleRate) * 1000;
  }

  // Interaural level difference (dB).
  if (calculateILD) {
    const rmsL = Math.sqrt(metrics.energyL / len);
    const rmsR = Math.sqrt(metrics.energyR / len);
    result.ild = rmsL > 1e-10 && rmsR > 1e-10 ? ampToDb(rmsR / rmsL, 1) : 0;
  }

  return result;
}

// Frame-based stereo metrics for timeline visualization.
export async function getTimeVaryingStereoAnalysis(
  audio: AudioData,
  options: StereoAnalysisOptions & { windowSize?: number } = {}
): Promise<{
  times: Float32Array;
  correlation: Float32Array;
  width: Float32Array;
  balance: Float32Array;
}> {
  if (audio.numberOfChannels < 2) {
    throw new AudioInspectError(
      'INVALID_INPUT',
      'Stereo analysis requires audio with at least two channels'
    );
  }

  const left = audio.channelData[0];
  const right = audio.channelData[1];
  if (!left || !right) {
    throw new AudioInspectError('INVALID_INPUT', 'L/R channel data is missing');
  }

  const len = Math.min(left.length, right.length);
  if (len === 0) {
    return {
      times: new Float32Array(0),
      correlation: new Float32Array(0),
      width: new Float32Array(0),
      balance: new Float32Array(0)
    };
  }

  const frameSize = Math.max(32, Math.min(options.windowSize ?? options.frameSize ?? 2048, len));
  const hopSize = options.hopSize ?? Math.max(1, Math.floor(frameSize / 2));
  if (hopSize <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'hopSize must be a positive integer');
  }

  const numFrames = len <= frameSize ? 1 : Math.floor((len - frameSize) / hopSize) + 1;
  const times = new Float32Array(numFrames);
  const correlation = new Float32Array(numFrames);
  const width = new Float32Array(numFrames);
  const balance = new Float32Array(numFrames);

  for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
    const start = frameIndex * hopSize;
    const end = Math.min(start + frameSize, len);
    const metrics = calculateStereoMetrics(
      left.subarray(start, end),
      right.subarray(start, end),
      false
    );

    times[frameIndex] = (start + (end - start) / 2) / audio.sampleRate;
    correlation[frameIndex] = metrics.correlation;
    width[frameIndex] = metrics.width;
    balance[frameIndex] = metrics.balance;
  }

  return {
    times,
    correlation,
    width,
    balance
  };
}

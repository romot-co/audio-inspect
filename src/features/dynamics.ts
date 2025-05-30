import { AudioData, AudioInspectError, AmplitudeOptions } from '../types.js';
import { getChannelData, ensureValidSample } from '../core/utils.js';
import { getRMS, getPeakAmplitude } from './time.js';

export interface CrestFactorOptions {
  channel?: number;
  windowSize?: number; // 窓サイズ（秒）
  hopSize?: number; // ホップサイズ（秒）
  method?: 'simple' | 'weighted'; // 重み付きクレストファクター
}

export interface CrestFactorResult {
  crestFactor: number; // 全体のクレストファクター (dB)
  crestFactorLinear: number; // 線形スケールのクレストファクター
  peak: number; // ピーク値（線形）
  rms: number; // RMS値（線形）
  timeVarying?:
    | {
        times: Float32Array;
        values: Float32Array; // dB
        valuesLinear: Float32Array; // 線形
        peaks: Float32Array;
        rmsValues: Float32Array;
      }
    | undefined;
}

function calculateFrameCrestFactor(
  frameData: Float32Array,
  method: 'simple' | 'weighted' = 'simple'
): { peak: number; rms: number; cfDb: number; cfLinear: number } {
  if (frameData.length === 0) {
    return { peak: 0, rms: 0, cfDb: -Infinity, cfLinear: 0 };
  }

  let processedData = frameData;

  // 重み付き処理（オプション）
  if (method === 'weighted') {
    // A-weightingの簡易実装
    // 実際にはIIRフィルタで実装すべき
    processedData = frameData; // プレースホルダー
  }

  let peakVal = 0;
  let sumOfSquares = 0;
  let validSamples = 0;

  for (let i = 0; i < processedData.length; i++) {
    const sample = ensureValidSample(processedData[i] ?? 0);
    const absSample = Math.abs(sample);

    peakVal = Math.max(peakVal, absSample);
    sumOfSquares += sample * sample;
    validSamples++;
  }

  if (validSamples === 0) {
    return { peak: 0, rms: 0, cfDb: -Infinity, cfLinear: 0 };
  }

  const rmsVal = Math.sqrt(sumOfSquares / validSamples);

  if (rmsVal < 1e-10) {
    return { peak: peakVal, rms: rmsVal, cfDb: Infinity, cfLinear: Infinity };
  }

  const cfLinear = peakVal / rmsVal;
  const cfDb = 20 * Math.log10(cfLinear);

  return { peak: peakVal, rms: rmsVal, cfDb, cfLinear };
}

export function getCrestFactor(
  audio: AudioData,
  options: CrestFactorOptions = {}
): CrestFactorResult {
  const { channel = 0, windowSize, hopSize, method = 'simple' } = options;

  // 全体のクレストファクター計算
  const amplitudeOpts: AmplitudeOptions = { channel, asDB: false };
  const overallPeak = getPeakAmplitude(audio, amplitudeOpts);
  const overallRms = getRMS(audio, amplitudeOpts);

  const overallCfLinear = overallRms > 1e-10 ? overallPeak / overallRms : Infinity;
  const overallCfDb = overallRms > 1e-10 ? 20 * Math.log10(overallCfLinear) : Infinity;

  let timeVaryingResult: CrestFactorResult['timeVarying'] | undefined;

  // 時変クレストファクター計算
  if (typeof windowSize === 'number' && typeof hopSize === 'number') {
    if (windowSize <= 0 || hopSize <= 0) {
      throw new AudioInspectError(
        'INVALID_INPUT',
        'windowSizeとhopSizeは正の値である必要があります'
      );
    }

    if (hopSize > windowSize) {
      console.warn(
        '[audio-inspect] hopSizeがwindowSizeより大きいため、分析窓間にギャップが生じます'
      );
    }

    const windowSizeSamples = Math.floor(windowSize * audio.sampleRate);
    const hopSizeSamples = Math.floor(hopSize * audio.sampleRate);

    if (windowSizeSamples === 0 || hopSizeSamples === 0) {
      throw new AudioInspectError('INVALID_INPUT', 'サンプルレートに対して窓サイズが小さすぎます');
    }

    const channelData = getChannelData(audio, channel);
    const dataLength = channelData.length;

    if (dataLength < windowSizeSamples) {
      // データが1窓分に満たない場合
      const result = calculateFrameCrestFactor(channelData, method);
      timeVaryingResult = {
        times: new Float32Array([audio.duration / 2]),
        values: new Float32Array([result.cfDb]),
        valuesLinear: new Float32Array([result.cfLinear]),
        peaks: new Float32Array([result.peak]),
        rmsValues: new Float32Array([result.rms])
      };
    } else {
      const frameCount = Math.floor((dataLength - windowSizeSamples) / hopSizeSamples) + 1;
      const times = new Float32Array(frameCount);
      const values = new Float32Array(frameCount);
      const valuesLinear = new Float32Array(frameCount);
      const peaks = new Float32Array(frameCount);
      const rmsValues = new Float32Array(frameCount);

      for (let i = 0; i < frameCount; i++) {
        const start = i * hopSizeSamples;
        const end = Math.min(start + windowSizeSamples, dataLength);
        const frameData = channelData.subarray(start, end);

        const frameResult = calculateFrameCrestFactor(frameData, method);

        times[i] = (start + windowSizeSamples / 2) / audio.sampleRate;
        values[i] = frameResult.cfDb;
        valuesLinear[i] = frameResult.cfLinear;
        peaks[i] = frameResult.peak;
        rmsValues[i] = frameResult.rms;
      }

      timeVaryingResult = { times, values, valuesLinear, peaks, rmsValues };
    }
  }

  return {
    crestFactor: overallCfDb,
    crestFactorLinear: overallCfLinear,
    peak: overallPeak,
    rms: overallRms,
    timeVarying: timeVaryingResult
  };
}

# audio-inspect

TypeScript-first audio analysis library for offline and realtime use.

## Install

```bash
npm i audio-inspect
```

## Public API

`audio-inspect` exports only these top-level APIs:

- `load(source, options?)`
- `analyze(audio, request)`
- `inspect(source, request)` (`load + analyze` convenience)
- `monitor(options)` (realtime session)
- `prepareWorklet(context, options?)` (optional preload)
- `FEATURES`
- `AudioInspectError`, `isAudioInspectError`

## Quick Start (Offline)

```ts
import { inspect } from 'audio-inspect';

const result = await inspect('audio.mp3', {
  load: { normalize: true, sampleRate: 48000, resampleQuality: 'high' },
  features: {
    rms: { asDB: true },
    spectrum: { fftSize: 2048 }
  }
});

console.log(result.results.rms);
console.log(result.results.spectrum?.frequencies.length);
```

## Decode Once, Analyze Many

```ts
import { load, analyze } from 'audio-inspect';

const audio = await load(file);

const pass1 = await analyze(audio, {
  features: { rms: true, peak: true }
});

const pass2 = await analyze(audio, {
  range: { start: 30, end: 45 },
  features: { lufs: true, spectralFeatures: true }
});
```

## Realtime Monitor

```ts
import { monitor } from 'audio-inspect';

const session = await monitor({
  context: audioContext,
  source: micStream,
  features: {
    rms: { asDB: true },
    peak: { asDB: true }
  },
  realtimePolicy: 'warn',
  heavyFeatureInterval: 4,
  emit: 'raf'
});

function loop() {
  const frame = session.read();
  if (frame) {
    // frame.sampleIndex is hop-aligned and useful for sync.
    renderMeters(frame.results.rms, frame.results.peak);
  }
  requestAnimationFrame(loop);
}

loop();
```

Realtime policy options:

- `realtimePolicy: 'warn' | 'allow' | 'strict'` (default: `'warn'`)
- `heavyFeatureInterval` (default: `4`)

Behavior:

- `'allow'`: execute all selected features every hop.
- `'warn'`: keep heavy features enabled, but execute them every `heavyFeatureInterval` frames.
- `'strict'`: ignore heavy realtime features and emit `REALTIME_POLICY_WARNING`.

## Dynamic Realtime Features

```ts
await session.setFeature('spectrum', { fftSize: 2048 });
await session.setFeature('spectrogram', {
  fftSize: 2048,
  frameSize: 2048,
  hopSize: 512,
  maxFrames: 60
});
await session.removeFeature('rms');
await session.setFeatures({ lufs: true, vad: { method: 'adaptive' } });
```

## Worklet Strategy

`monitor()` is AudioWorklet-only. If AudioWorklet is unavailable, it throws `WORKLET_NOT_SUPPORTED`.

Optional preload:

```ts
import { prepareWorklet } from 'audio-inspect';

await prepareWorklet(audioContext, {
  moduleUrl: '/core/realtime/processor.js'
});
```

## Node.js Offline Decode

In Node.js, compressed/container decoding requires decoder injection:

```ts
import { load } from 'audio-inspect';

const audio = await load(buffer, {
  decoder: {
    name: 'my-decoder',
    async decode(input) {
      // return AudioData
      return decodedAudioData;
    }
  }
});
```

If decode backend is missing, `load()` throws `DECODE_BACKEND_MISSING`.

If `sampleRate` conversion is requested, high-quality resampling is the default.

- Browser: uses `OfflineAudioContext` when available.
- Node.js: provide `load.resampler` for high-quality conversion, or set `resampleQuality: 'fast'` to opt into linear interpolation.

## Error Handling

All public failures throw `AudioInspectError`.

```ts
import { isAudioInspectError } from 'audio-inspect';

try {
  // ...
} catch (error) {
  if (isAudioInspectError(error)) {
    console.error(error.code, error.message);
  }
}
```

## Feature Selection Basics

`features` in `analyze`, `inspect`, and `monitor` supports two forms:

```ts
// 1) Object form (recommended when setting options)
features: {
  rms: true,                       // true = default options
  spectrum: { fftSize: 2048 }      // override options
}

// 2) Array form (default options only)
features: ['rms', 'peak', 'lufs']
```

You can list all available feature IDs with `FEATURES`:

```ts
import { FEATURES } from 'audio-inspect';
console.log(FEATURES);
```

For option types in TypeScript:

```ts
import type { FeatureOptions } from 'audio-inspect';
type LufsOptions = FeatureOptions<'lufs'>;
```

## Feature Quick Reference

### Time / Level

| Feature                                            | What it does                         | Common options                                                                    |
| -------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `rms`, `peak`                                      | Level measurement (linear or dB)     | `channel`, `asDB`, `reference`, `truePeak`, `oversamplingFactor`, `interpolation` |
| `zeroCrossing`                                     | Zero-crossing rate                   | `channel`                                                                         |
| `peaks`                                            | Peak detection                       | `count`, `threshold`, `channel`, `minDistance`                                    |
| `waveform`                                         | Lightweight waveform summary         | `framesPerSecond`, `channel`, `method`                                            |
| `rmsAnalysis`, `peaksAnalysis`, `waveformAnalysis` | TypedArray-oriented analysis results | Base feature options + `onProgress`                                               |
| `energy`                                           | Short-time energy over frames        | `frameSize`, `hopSize`, `channel`, `normalized`, `windowFunction`                 |

### Frequency / Spectral

| Feature                       | What it does                                 | Common options                                                                                                                        |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `fft`                         | Single-frame FFT                             | `fftSize`, `windowFunction`, `channel`, `provider`, `enableProfiling`                                                                 |
| `spectrum`                    | Band-limited single-frame spectrum           | `fftSize`, `minFrequency`, `maxFrequency`, `scale`, `normalization`, `windowFunction`, `channel`                                      |
| `spectrogram`                 | Multi-frame STFT/spectrogram sequence        | `fftSize`, `frameSize`, `hopSize`, `maxFrames`, `minFrequency`, `maxFrequency`, `scale`, `normalization`, `windowFunction`, `channel` |
| `spectralFeatures`            | Centroid/bandwidth/rolloff/flatness and more | `fftSize`, `windowFunction`, `minFrequency`, `maxFrequency`, `rolloffThreshold`                                                       |
| `timeVaryingSpectralFeatures` | Time-series version of spectral features     | `frameSize`, `hopSize`, `numFrames` + spectral feature options                                                                        |
| `spectralEntropy`             | Spectral entropy                             | `fftSize`, `windowFunction`, `minFrequency`, `maxFrequency`                                                                           |
| `spectralCrest`               | Spectral crest factor                        | `fftSize`, `windowFunction`, `minFrequency`, `maxFrequency`, `asDB`                                                                   |

### Mel / CQT / MFCC

| Feature          | What it does                  | Common options                                                                                                                        |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `melSpectrogram` | Mel spectrogram               | `frameSizeMs`, `hopSizeMs`, `fftSize`, `numMelFilters`, `minFrequency`, `maxFrequency`, `preEmphasis`, `power`, `logScale`            |
| `cqt`            | CQT (FFT-based approximation) | `frameSizeMs`, `hopSizeMs`, `fftSize`, `fMin`, `binsPerOctave`, `numBins`, `preEmphasis`, `power`, `logScale`                         |
| `mfcc`           | MFCC coefficients             | `frameSizeMs`, `hopSizeMs`, `fftSize`, `numMelFilters`, `numMfccCoeffs`, `minFrequency`, `maxFrequency`, `preEmphasis`, `lifterCoeff` |
| `mfccWithDelta`  | MFCC + delta + delta-delta    | All `mfcc` options + `deltaWindowSize`, `computeDelta`, `computeDeltaDelta`                                                           |

### Loudness / Voice / Dynamics

| Feature       | What it does                                           | Common options                                                                                                                                             |
| ------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lufs`        | Integrated/momentary/short-term/LRA/true-peak loudness | `channelMode`, `gated`, `calculateMomentary`, `calculateShortTerm`, `collectSeries`, `calculateLoudnessRange`, `calculateTruePeak`, `truePeakMethod`, `truePeakOversamplingFactor`, `truePeakInterpolation`                         |
| `vad`         | Voice activity detection                               | `method`, `frameSizeMs`, `hopSizeMs`, `energyThreshold`, `zcrThresholdLow`, `zcrThresholdHigh`, `adaptiveAlpha`, `noiseFactor`, `preEmphasis`, `smoothing` |
| `crestFactor` | Crest factor analysis                                  | `channel`, `windowSize`, `hopSize`, `method`                                                                                                               |

`lufs.truePeakMethod` defaults to `bs1770` (polyphase FIR). In `bs1770` mode, `truePeakOversamplingFactor` must be `2` or `4`.
`lufs.momentary` and `lufs.shortTerm` are scalar snapshots. For offline frame series, set `collectSeries`.

### Stereo

| Feature             | What it does                            | Common options                                                                                          |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `stereo`            | Correlation/width/balance/phase/ITD/ILD | `frameSize`, `hopSize`, `calculatePhase`, `calculateITD`, `calculateILD`, `provider`, `enableProfiling` |
| `timeVaryingStereo` | Time-varying stereo metrics             | `windowSize` + stereo options                                                                           |

## Presets (Copy/Paste)

### 1) Lightweight meter

```ts
features: {
  rms: { asDB: true },
  peak: { asDB: true, truePeak: true }
}
```

### 2) Spectrum visualization

```ts
features: {
  spectrogram: {
    fftSize: 2048,
    frameSize: 2048,
    hopSize: 512,
    maxFrames: 120,
    minFrequency: 20,
    maxFrequency: 20000,
    scale: 'dbfs'
  }
}
```

### 3) Voice activity detection (VAD)

```ts
features: {
  vad: {
    method: 'adaptive',
    frameSizeMs: 25,
    hopSizeMs: 10,
    preEmphasis: true,
    smoothing: true
  }
}
```

### 4) Music-oriented bundle

```ts
features: {
  lufs: { calculateShortTerm: true, calculateTruePeak: true },
  spectralFeatures: true,
  mfccWithDelta: { numMfccCoeffs: 13, computeDelta: true, computeDeltaDelta: true },
  stereo: { calculatePhase: true }
}
```

## LICENSE

MIT

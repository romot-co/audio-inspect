# audio-inspect

A lightweight yet powerful audio analysis library for web and Node.js environments

[![npm version](https://img.shields.io/npm/v/audio-inspect.svg)](https://www.npmjs.com/package/audio-inspect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Time Domain Analysis**: Peak detection, RMS calculation, zero-crossing rate, waveform extraction
- **Frequency Domain Analysis**: FFT analysis, spectrum analysis, spectrogram generation
- **Advanced Audio Features**: LUFS loudness, spectral features, voice activity detection (VAD)
- **Real-time Processing**: AudioWorklet-based real-time analysis with custom AudioNode
- **Enhanced Audio Analysis**: A-weighted crest factor, True Peak detection, MFCC, spectral entropy/crest
- **High Performance**: Float32Array-based results, parallel batch processing
- **TypeScript Ready**: Full type definitions with comprehensive error handling
- **Tree-shaking Support**: Import only what you need for optimal bundle size

## Installation

```bash
# Install the latest beta version
npm install audio-inspect@beta

# Or from GitHub
npm install github:romot-co/audio-inspect
```

## Quick Start

### Basic Usage

```typescript
import { load, getPeaksAnalysis, getSpectrum } from 'audio-inspect';

// Load audio file
const audio = await load('path/to/audio.mp3');

// Enhanced peak analysis with Float32Array results
const peaks = getPeaksAnalysis(audio, {
  count: 50,
  threshold: 0.1,
  onProgress: (percent, message) => console.log(`${percent}%: ${message}`)
});

// Spectrum analysis with frequency filtering
const spectrum = await getSpectrum(audio, {
  fftSize: 2048,
  minFrequency: 80,
  maxFrequency: 8000
});

console.log(peaks.positions);    // Float32Array of peak positions
console.log(peaks.amplitudes);  // Float32Array of peak amplitudes
```

### Real-time Audio Analysis

```typescript
import { createAudioInspectNode } from 'audio-inspect';

const audioContext = new AudioContext();
const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
const sourceNode = audioContext.createMediaStreamSource(mediaStream);

// Create AudioInspectNode
const inspectNode = createAudioInspectNode(audioContext, {
  featureName: 'getRMS',
  bufferSize: 1024,
  hopSize: 512
});

// Set up event handlers
inspectNode.onresult = (event) => {
  console.log('RMS:', event.data, 'at', event.timestamp);
};

// Connect to Web Audio API graph
sourceNode.connect(inspectNode);

// Update analysis in real-time
inspectNode.updateOptions({
  featureName: 'getPeaks',
  featureOptions: { count: 5, threshold: 0.5 }
});
```

## Enhanced Audio Analysis Features

### 1. Weighted Crest Factor (A-Weighted Crest Factor)
ITU-R BS.1770 compliant A-weighting filter for perceptual loudness measurement.

```typescript
import { getCrestFactor } from 'audio-inspect/features/dynamics';

const audio = await load('audio.mp3');

// Traditional crest factor
const simpleCF = getCrestFactor(audio, { method: 'simple' });

// A-weighted crest factor for perceptual analysis
const weightedCF = getCrestFactor(audio, { method: 'weighted' });

console.log(`Crest Factor: ${simpleCF.crestFactor} dB`);
console.log(`A-weighted CF: ${weightedCF.crestFactor} dB`);
```

### 2. True Peak Detection (Inter-Sample Peak Detection)
Oversampling-based inter-sample peak detection to prevent digital clipping.

```typescript
import { getPeakAmplitude } from 'audio-inspect/features/time';

const audio = await load('audio.mp3');

// True Peak with 4x oversampling and cubic interpolation
const truePeak = getPeakAmplitude(audio, { 
  truePeak: true,
  oversamplingFactor: 4,
  interpolation: 'cubic'
});

console.log(`True Peak: ${truePeak} dB`);
```

### 3. MFCC (Mel-Frequency Cepstral Coefficients)
Comprehensive MFCC implementation for machine learning and speech analysis.

```typescript
import { getMFCC, getMFCCWithDelta } from 'audio-inspect/features/spectral';

const audio = await load('speech.wav');

// Basic MFCC
const mfcc = await getMFCC(audio, {
  frameSizeMs: 25,
  hopSizeMs: 10,
  numMfccCoeffs: 13,
  numMelFilters: 40
});

// MFCC with delta and delta-delta coefficients
const mfccWithDelta = await getMFCCWithDelta(audio, {
  computeDelta: true,
  computeDeltaDelta: true
});

console.log(`MFCC: ${mfcc.mfcc.length} frames × ${mfcc.frameInfo.numCoeffs} coefficients`);
```

### 4. Spectral Entropy & Crest Factor
Measure spectral randomness and peak-to-average ratio in frequency domain.

```typescript
import { getSpectralEntropy, getSpectralCrest } from 'audio-inspect/features/spectral';

const audio = await load('audio.mp3');

// Spectral entropy (noise vs. tonal content)
const entropy = await getSpectralEntropy(audio, {
  fftSize: 2048,
  minFrequency: 20,
  maxFrequency: 20000
});

// Spectral crest factor (harmonic vs. noise content)
const spectralCrest = await getSpectralCrest(audio, {
  fftSize: 2048,
  asDB: true
});

console.log(`Spectral Entropy: ${entropy.entropy} bits (${entropy.entropyNorm} normalized)`);
console.log(`Spectral Crest Factor: ${spectralCrest.crestDB} dB`);
```

## Core API

### Audio Loading
```typescript
const audio = await load(source, {
  sampleRate: 44100,    // Target sample rate
  channels: 'mono',     // Channel configuration
  normalize: false      // Normalize amplitude
});
```

### Time Domain Analysis
```typescript
// Enhanced waveform analysis
const waveform = getWaveformAnalysis(audio, {
  frameCount: 3600,     // 1 minute at 60 FPS
  channel: 0,
  onProgress: (percent, message) => console.log(`${percent}%: ${message}`)
});

// Peak detection
const peaks = getPeaksAnalysis(audio, {
  count: 100,
  threshold: 0.1,
  channel: 0
});

// RMS analysis
const rms = getRMSAnalysis(audio, {
  channel: 0,
  asDB: true
});
```

### Frequency Domain Analysis
```typescript
// FFT analysis
const fft = await getFFT(audio, {
  fftSize: 2048,
  windowFunction: 'hann',
  provider: 'webfft'    // Fast WASM implementation
});

// Spectrum analysis
const spectrum = await getSpectrum(audio, {
  fftSize: 2048,
  minFrequency: 20,
  maxFrequency: 20000,
  timeFrames: 100       // Generate spectrogram
});
```

### Audio Features
```typescript
// LUFS loudness measurement
const loudness = getLUFS(audio, {
  gated: true,
  shortTerm: true,
  momentary: true
});

// Voice Activity Detection
const vad = getVAD(audio, {
  method: 'adaptive',
  energyThreshold: 0.01,
  frameSizeMs: 25
});

// Spectral features
const spectral = getSpectralFeatures(audio, {
  fftSize: 2048,
  features: ['centroid', 'bandwidth', 'rolloff', 'flatness']
});
```

### Batch Processing
```typescript
import { analyzeAll } from 'audio-inspect/core/batch';

const results = await analyzeAll(audio, {
  waveform: { frameCount: 1000 },
  peaks: { count: 50, threshold: 0.1 },
  rms: { channel: 0 },
  spectrum: { fftSize: 2048 },
  onProgress: (percent, currentTask) => {
    console.log(`Processing: ${percent}% (${currentTask})`);
  }
});
```

## Tree-shaking Support

Import only the features you need:

```typescript
// Time domain only
import { getPeaksAnalysis, getWaveformAnalysis } from 'audio-inspect/features/time';

// Frequency domain only
import { getFFT, getSpectrum } from 'audio-inspect/features/frequency';

// Audio features only
import { getLUFS } from 'audio-inspect/features/loudness';
import { getVAD } from 'audio-inspect/features/vad';
```

## Browser Compatibility

- Chrome 66+ (WebAssembly support for WebFFT)
- Firefox 60+ (WebAssembly support)
- Safari 12+ (WebAssembly support)
- Edge 79+ (WebAssembly support)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Build library
npm run build

# Quality checks
npm run format && npm run lint && npm run type-check
```

## License

MIT License - see the [LICENSE](LICENSE) file for details.
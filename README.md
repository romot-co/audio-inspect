# audio-inspect

A lightweight yet powerful audio analysis library for web and Node.js environments (v0.1.1)

## Features

- **Time Domain Analysis**: Peak detection, RMS calculation, zero-crossing rate, waveform extraction
- **Frequency Domain Analysis**: FFT analysis, spectrum analysis, spectrogram generation with frequency filtering
- **Audio Feature Extraction**: Energy, dynamics, loudness (LUFS), spectral features, voice activity detection (VAD)
- **Sample Rate Conversion**: High-quality resampling using OfflineAudioContext
- **Multiple FFT Providers**: WebFFT (fast WASM) and native JavaScript implementations
- **Tree-shaking Support**: Import only what you need for optimal bundle size
- **TypeScript Ready**: Full type definitions included
- **Comprehensive Testing**: 227 tests with 77% coverage

## Installation

### Install from GitHub (Recommended)

```bash
npm install github:romot-co/audio-inspect
```

### Requirements

- Node.js 18+
- Browser environment (Web Audio API support)
- ES Modules or CommonJS support

## Quick Start

### Basic Usage

```typescript
// ES Modules
import { load, analyze, getPeaks, getSpectrum } from 'audio-inspect';

// CommonJS (Node.js)
const { load, analyze, getPeaks, getSpectrum } = require('audio-inspect');

// Tree-shaking friendly imports
import { getPeaks } from 'audio-inspect/features/time';
import { getFFT } from 'audio-inspect/features/frequency';
```

### Time Domain Analysis

```typescript
import { load, getPeaks, getWaveform } from 'audio-inspect';

// Load audio file
const audio = await load('path/to/audio.mp3');

// Peak detection
const peaks = getPeaks(audio, { 
  count: 10, 
  threshold: 0.5,
  minDistance: 441 // Minimum distance between peaks
});

// Waveform extraction (60 FPS)
const waveform = getWaveform(audio, {
  framesPerSecond: 60,
  method: 'rms', // 'rms' | 'peak' | 'average'
  channel: 0
});

console.log(peaks.peaks); // Array of detected peaks
console.log(waveform.waveform); // Time-series waveform data
```

### Frequency Domain Analysis

```typescript
import { getFFT, getSpectrum } from 'audio-inspect/features/frequency';

// FFT analysis with WebFFT provider
const fft = await getFFT(audio, {
  fftSize: 2048,
  windowFunction: 'hann',
  provider: 'webfft' // Fast WASM implementation
});

// Spectrum analysis with frequency filtering
const spectrum = await getSpectrum(audio, {
  fftSize: 2048,
  minFrequency: 80,     // Filter frequencies below 80Hz
  maxFrequency: 8000,   // Filter frequencies above 8kHz
  decibels: true
});

// Spectrogram generation
const spectrogram = await getSpectrum(audio, {
  fftSize: 1024,
  timeFrames: 100,      // Generate 100 time frames
  overlap: 0.75,        // 75% overlap between frames
  minFrequency: 20,
  maxFrequency: 20000
});

console.log(spectrogram.spectrogram); // Time vs frequency intensity matrix
```

### Advanced Audio Features

```typescript
import { getLUFS } from 'audio-inspect/features/loudness';
import { getVAD } from 'audio-inspect/features/vad';
import { getSpectralFeatures } from 'audio-inspect/features/spectral';

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
  frameSizeMs: 25,
  hopSizeMs: 10
});

// Spectral features
const spectral = getSpectralFeatures(audio, {
  fftSize: 2048,
  features: ['centroid', 'bandwidth', 'rolloff', 'flatness']
});
```

### Sample Rate Conversion

```typescript
// High-quality resampling
const resampledAudio = await load(audio, {
  sampleRate: 48000,    // Convert to 48kHz
  channels: 'mono',     // Convert to mono
  normalize: true       // Normalize amplitude
});
```

## FFT Providers

### WebFFT (Recommended)
- Uses [WebFFT](https://github.com/IQEngine/WebFFT) WebAssembly implementation
- Fast performance with automatic optimization
- Profiling capabilities for performance analysis

### Native DFT
- Pure JavaScript implementation
- Compatibility-focused (for environments without WASM support)
- Educational value for understanding FFT algorithms

```typescript
// Switch between providers
const fftWebFFT = await getFFT(audio, { provider: 'webfft' });
const fftNative = await getFFT(audio, { provider: 'native' });

// Enable profiling (WebFFT only)
const fftProfiled = await getFFT(audio, { 
  provider: 'webfft', 
  enableProfiling: true 
});
```

## Tree-shaking Support

Import only the features you need to optimize bundle size:

```typescript
// Time domain only
import { getPeaks, getWaveform } from 'audio-inspect/features/time';

// Frequency domain only
import { getFFT, getSpectrum } from 'audio-inspect/features/frequency';

// Audio features only
import { getLUFS } from 'audio-inspect/features/loudness';
import { getVAD } from 'audio-inspect/features/vad';

// Core utilities only
import { FFTProviderFactory } from 'audio-inspect/core/fft-provider';
```

## API Reference

### Core Functions

#### `load(source, options?)`

Load and preprocess audio data from various sources.

```typescript
const audio = await load(source, {
  sampleRate: 44100,    // Target sample rate
  channels: 'mono',     // Channel configuration
  normalize: false      // Normalize amplitude
});
```

**Parameters:**
- `source`: AudioSource (File, Blob, ArrayBuffer, URL, AudioBuffer, or AudioData)
- `options`: LoadOptions (optional)

**Returns:** Promise<AudioData>

### Time Domain Analysis

#### `getPeaks(audio, options?)`

Detect peaks in audio signal with configurable parameters.

```typescript
const peaks = getPeaks(audio, {
  count: 100,          // Maximum number of peaks
  threshold: 0.1,      // Detection threshold (0-1)
  channel: 0,          // Target channel (-1 for average)
  minDistance: 441     // Minimum distance between peaks
});
```

#### `getWaveform(audio, options?)`

Extract waveform data at specified resolution.

```typescript
const waveform = getWaveform(audio, {
  framesPerSecond: 60,  // Temporal resolution
  channel: 0,           // Target channel
  method: 'rms'         // 'rms' | 'peak' | 'average'
});
```

#### `getRMS(audio, options?)`

Calculate Root Mean Square amplitude.

```typescript
const rms = getRMS(audio, {
  channel: 0,           // Target channel
  asDB: false,          // Return in dB
  reference: 1.0        // Reference level for dB calculation
});
```

#### `getZeroCrossing(audio, channel?)`

Calculate zero-crossing rate.

```typescript
const zcr = getZeroCrossing(audio, 0); // Returns rate (0-1)
```

### Frequency Domain Analysis

#### `getFFT(audio, options?)`

Perform FFT analysis with configurable parameters.

```typescript
const fft = await getFFT(audio, {
  fftSize: 2048,               // FFT size (power of 2)
  windowFunction: 'hann',      // Window function
  channel: 0,                  // Target channel
  provider: 'webfft',          // FFT provider
  enableProfiling: false       // Enable performance profiling
});
```

#### `getSpectrum(audio, options?)`

Perform spectrum analysis with frequency filtering and spectrogram generation.

```typescript
const spectrum = await getSpectrum(audio, {
  fftSize: 2048,
  minFrequency: 20,      // Low-cut frequency
  maxFrequency: 20000,   // High-cut frequency
  decibels: true,        // Return dB values
  timeFrames: 1,         // 1=spectrum, >1=spectrogram
  overlap: 0.5           // Frame overlap ratio
});
```

### Audio Features

#### `getLUFS(audio, options?)`

Calculate loudness according to ITU-R BS.1770 standard.

```typescript
const loudness = getLUFS(audio, {
  gated: true,           // Apply gating
  shortTerm: false,      // Calculate short-term loudness
  momentary: false,      // Calculate momentary loudness
  truePeak: false        // Calculate true peak
});
```

#### `getVAD(audio, options?)`

Voice Activity Detection with multiple algorithms.

```typescript
const vad = getVAD(audio, {
  method: 'adaptive',         // 'energy' | 'zcr' | 'combined' | 'adaptive'
  energyThreshold: 0.01,      // Energy threshold
  frameSizeMs: 25,            // Frame size in milliseconds
  hopSizeMs: 10,              // Hop size in milliseconds
  minSpeechDurationMs: 100,   // Minimum speech duration
  minSilenceDurationMs: 100   // Minimum silence duration
});
```

## Implementation Status

### ✅ Implemented Features (v0.1.1)

- **Core Functions**
  - `load` - Audio loading with sample rate conversion
  - `analyze` - Feature extraction framework

- **Time Domain Analysis**
  - `getPeaks` - Peak detection with spatial filtering
  - `getRMS` - RMS calculation
  - `getZeroCrossing` - Zero-crossing rate
  - `getWaveform` - Waveform extraction with extreme frame rate handling

- **Frequency Domain Analysis**
  - `getFFT` - FFT analysis with multiple providers
  - `getSpectrum` - Spectrum analysis with frequency filtering
  - Spectrogram generation with configurable parameters

- **Audio Features**
  - `getLUFS` - Loudness measurement (ITU-R BS.1770)
  - `getVAD` - Voice Activity Detection
  - `getSpectralFeatures` - Spectral feature extraction
  - `getEnergy` - Energy analysis
  - `getDynamics` - Dynamic range analysis

- **Core Infrastructure**
  - Multiple FFT providers (WebFFT/Native)
  - Sample rate conversion (OfflineAudioContext)
  - Tree-shaking support
  - Comprehensive error handling

### 🚧 Planned Features

- `stream` - Real-time streaming analysis (v0.2.0)
- Enhanced Node.js support (v0.3.0)
- MFCC (Mel-Frequency Cepstral Coefficients)
- Advanced pitch detection algorithms
- Audio similarity analysis

## Test Results

The library is thoroughly tested with comprehensive test coverage:

- **Total Tests**: 227 tests passing
- **Test Coverage**: 76.97% overall
  - Statements: 76.97% (1825/2371)
  - Branches: 81.66% (423/518)
  - Functions: 85.05% (74/87)
  - Lines: 76.97% (1825/2371)

### Recent Improvements

**Implementation Bug Fixes (v0.1.1)**:
1. ✅ Fixed frequency range filtering in spectrogram analysis
2. ✅ Improved short audio data processing in FFT analysis
3. ✅ Enhanced extreme frame rate handling in waveform extraction
4. ✅ Implemented sample rate conversion functionality

**Coverage Improvements**:
- `frequency.ts`: 93.11% (+1% improvement)
- `time.ts`: 82.86% (improved branch coverage)
- `load.ts`: 53.29% (significant improvement with new features)
- `loudness.ts`: 97.95%
- `spectral.ts`: 90.45%
- `vad.ts`: 92.89%

## Known Limitations

1. **Node.js Environment**: Audio file decoding requires Web Audio API (browser environment only)
2. **Sample Rate Conversion**: Requires OfflineAudioContext support
3. **Streaming**: Real-time streaming analysis not yet implemented
4. **Large Files**: Memory usage scales with audio file size

## Browser Compatibility

- Chrome 66+ (WebAssembly support for WebFFT)
- Firefox 60+ (WebAssembly support)
- Safari 12+ (WebAssembly support)
- Edge 79+ (WebAssembly support)

For older browsers, the native FFT provider provides fallback functionality.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build library
npm run build

# Run linter
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

### Development Commands

```bash
# Watch mode for development
npm run dev

# Build documentation
npm run docs

# Performance benchmarks
npm run benchmark
```

## License

MIT License

## Acknowledgments

- [WebFFT](https://github.com/IQEngine/WebFFT) for high-performance FFT implementation
- [ITU-R BS.1770](https://www.itu.int/rec/R-REC-BS.1770/) for loudness measurement standards
- Web Audio API specification for audio processing capabilities

# audio-inspect

A lightweight yet powerful audio analysis library for web and Node.js environments (v0.1.1)

## Features

- **Time Domain Analysis**: Peak detection, RMS calculation, zero-crossing rate, waveform extraction
- **Frequency Domain Analysis**: FFT analysis, spectrum analysis, spectrogram generation with frequency filtering
- **Audio Feature Extraction**: Energy, dynamics, loudness (LUFS), spectral features, voice activity detection (VAD)
- **Real-time Streaming Analysis**: AudioWorklet-based real-time audio processing with custom AudioNode
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

### Real-time Audio Analysis (AudioWorklet)

AudioInspectNodeは標準のAudioNodeとしてWeb Audio APIグラフに統合できるカスタムAudioNodeです。

```typescript
import { createAudioInspectNode } from 'audio-inspect';

// AudioContextとMediaStreamの準備
const audioContext = new AudioContext();
const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
const sourceNode = audioContext.createMediaStreamSource(mediaStream);

// AudioInspectNodeを作成（同期的）
const inspectNode = createAudioInspectNode(audioContext, {
  featureName: 'getRMS',
  bufferSize: 1024,
  hopSize: 512
});

// イベントハンドラーを設定
inspectNode.onresult = (event) => {
  console.log('RMS:', event.data, 'at', event.timestamp);
};

inspectNode.onerror = (event) => {
  console.error('Analysis error:', event.message);
};

// Web Audio APIグラフに接続
sourceNode.connect(inspectNode);

// リアルタイムで解析オプションを変更
inspectNode.updateOptions({
  featureName: 'getPeaks',
  featureOptions: { count: 5, threshold: 0.5 }
});

// 内部状態をリセット
inspectNode.reset();

// リソースを解放
inspectNode.dispose();
```

## AudioWorklet Setup

The library includes a pre-bundled AudioWorklet processor that includes all dependencies:

```javascript
// Correct usage - use the bundled processor
const processorUrl = '/node_modules/audio-inspect/dist/core/AudioInspectProcessor.js';

// Or if serving from your own server
const processorUrl = '/assets/AudioInspectProcessor.js';

// Initialize with the bundled processor
await audioContext.audioWorklet.addModule(processorUrl);
const inspectNode = createAudioInspectNode(audioContext, options);
```

### Important Notes:
- The processor file must be served with `Content-Type: application/javascript`
- The bundled processor includes all necessary dependencies
- No additional module imports are needed in the AudioWorklet context

### Helper Functions for AudioWorklet

```typescript
import { 
  getDefaultProcessorUrl, 
  createAudioInspectNodeWithDefaults,
  streamWithFallback 
} from 'audio-inspect';

// Get default processor URL (automatically detects dev/prod environment)
const processorUrl = getDefaultProcessorUrl();

// Create AudioInspectNode with default settings
const inspectNode = await createAudioInspectNodeWithDefaults(audioContext, 'getRMS');

// Stream with fallback for better compatibility
const controller = await streamWithFallback(
  mediaStream,
  'getPeaks',
  {
    processorModuleUrl: processorUrl,
    enableFallback: true,
    fallbackHandler: (audioData) => {
      console.log('Fallback processing:', audioData);
    }
  },
  (result) => console.log('Peak result:', result),
  (error) => console.error('Stream error:', error)
);
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

- **Real-time Audio Analysis**
  - `createAudioInspectNode` - AudioWorklet-based real-time analysis
  - `AudioInspectNode` - Custom AudioNode with real-time capabilities
  - Real-time feature extraction with dynamic configuration

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

- `stream` - High-level streaming API wrapper (v0.2.0)
- Enhanced Node.js support (v0.3.0)
- MFCC (Mel-Frequency Cepstral Coefficients)
- Advanced pitch detection algorithms
- Audio similarity analysis

## Test Results

The library is thoroughly tested with comprehensive test coverage:

- **Total Tests**: 206 tests passing (13 test files)
- **E2E Tests**: 1 test passing (AudioInspectNode integration)
- **Test Coverage**: 65.93% overall
  - Statements: 65.93% coverage
  - High-quality tests focusing on critical functionality
  - Real-time AudioWorklet testing with Playwright

### Recent Improvements

**AudioInspectNode Implementation (v0.1.1)**:
1. ✅ AudioWorkletNode inheritance for true AudioNode compatibility
2. ✅ Real-time audio analysis with dynamic configuration
3. ✅ E2E testing with synthetic audio for CI/CD automation
4. ✅ Comprehensive error handling and event system

**Key Test Categories**:
- Unit tests for all audio analysis features
- Integration tests for complex workflows
- E2E tests for real-time AudioNode functionality
- Performance tests for large audio files
- Cross-browser compatibility testing

## Known Limitations

1. **Node.js Environment**: Audio file decoding requires Web Audio API (browser environment only)
2. **Sample Rate Conversion**: Requires OfflineAudioContext support
3. **High-level Streaming API**: `stream()` wrapper function not yet implemented
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

## Real-time Processing Features

- ✅ **AudioInspectNode**: Custom AudioNode with real-time analysis
- ✅ **AudioWorklet Integration**: Low-latency audio processing
- ✅ **Dynamic Configuration**: Runtime parameter updates
- ✅ **Event System**: Both callback and CustomEvent support
- 🚧 **Stream API**: High-level wrapper for easier integration (planned v0.2.0)
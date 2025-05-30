# audio-inspect

A lightweight yet powerful audio analysis library for web and Node.js environments

[![npm version](https://img.shields.io/npm/v/audio-inspect.svg)](https://www.npmjs.com/package/audio-inspect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Enhanced Data Structures**: Float32Array-based results for optimal performance and visualization compatibility
- **Time Domain Analysis**: Peak detection, RMS calculation, zero-crossing rate, waveform extraction with progress callbacks
- **Frequency Domain Analysis**: FFT analysis, spectrum analysis, spectrogram generation with frequency filtering
- **Audio Feature Extraction**: Energy, dynamics, loudness (LUFS), spectral features, voice activity detection (VAD)
- **Real-time Streaming Analysis**: AudioWorklet-based real-time audio processing with custom AudioNode
- **Batch Processing**: Parallel analysis of multiple features with weighted progress reporting
- **Sample Rate Conversion**: High-quality resampling using OfflineAudioContext
- **Multiple FFT Providers**: WebFFT (fast WASM) and native JavaScript implementations
- **Tree-shaking Support**: Import only what you need for optimal bundle size
- **TypeScript Ready**: Full type definitions with enhanced error handling
- **Comprehensive Testing**: 226 tests with robust coverage

## Installation

### Install from npm (Prerelease)

```bash
# Install the latest beta version
npm install audio-inspect@beta

# Or specify exact version
npm install audio-inspect@0.0.1-beta.0
```

### Install from GitHub

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
import { getPeaksAnalysis } from 'audio-inspect/features/time';
import { getFFT } from 'audio-inspect/features/frequency';
```

### New Enhanced API (v0.0.1-beta.0)

```typescript
import { getWaveformAnalysis, getPeaksAnalysis, getRMSAnalysis } from 'audio-inspect/features/time';
import { analyzeAll } from 'audio-inspect/core/batch';

// Load audio file
const audio = await load('path/to/audio.mp3');

// Enhanced waveform analysis with progress callbacks
const waveformResult = getWaveformAnalysis(audio, {
  frameCount: 1000,
  channel: 0,
  onProgress: (percent, message) => {
    console.log(`Waveform analysis: ${percent}% - ${message}`);
  }
});

// Enhanced peak analysis with Float32Array results
const peaksResult = getPeaksAnalysis(audio, {
  count: 50,
  threshold: 0.1,
  channel: 0,
  onProgress: (percent, message) => {
    console.log(`Peak analysis: ${percent}% - ${message}`);
  }
});

// Batch processing - analyze multiple features in parallel
const batchResult = await analyzeAll(audio, {
  waveform: { frameCount: 500 },
  peaks: { count: 20, threshold: 0.2 },
  rms: { channel: 0 },
  spectrum: { fftSize: 2048 },
  energy: { windowSize: 0.1 },
  onProgress: (percent, currentTask) => {
    console.log(`Batch analysis: ${percent}% - Processing ${currentTask}`);
  }
});

// Results are now Float32Array for optimal performance
console.log(waveformResult.amplitudes); // Float32Array
console.log(peaksResult.positions);     // Float32Array
console.log(peaksResult.amplitudes);   // Float32Array
```

### Real-time Audio Analysis (AudioWorklet)

AudioInspectNode is a custom AudioNode that integrates seamlessly with the Web Audio API graph.

```typescript
import { createAudioInspectNode } from 'audio-inspect';

// Prepare AudioContext and MediaStream
const audioContext = new AudioContext();
const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
const sourceNode = audioContext.createMediaStreamSource(mediaStream);

// Create AudioInspectNode (synchronously)
const inspectNode = createAudioInspectNode(audioContext, {
  featureName: 'getRMS',
  bufferSize: 1024,
  hopSize: 512
});

// Set up event handlers
inspectNode.onresult = (event) => {
  console.log('RMS:', event.data, 'at', event.timestamp);
};

inspectNode.onerror = (event) => {
  console.error('Analysis error:', event.message);
};

// Connect to Web Audio API graph
sourceNode.connect(inspectNode);

// Update analysis options in real-time
inspectNode.updateOptions({
  featureName: 'getPeaks',
  featureOptions: { count: 5, threshold: 0.5 }
});

// Reset internal state
inspectNode.reset();

// Release resources
inspectNode.dispose();
```

## Enhanced Type System

The library now features a completely redesigned type system optimized for performance and ease of use:

```typescript
// Base result interface
interface BaseAnalysisResult {
  sampleRate: number;
  duration: number;
  processingTime?: number;
}

// Enhanced waveform result with Float32Array
interface WaveformAnalysisResult extends BaseAnalysisResult {
  amplitudes: Float32Array;      // Direct use with visualization libraries
  timestamps?: Float32Array;     // Optional time stamps
  frameCount: number;
  samplesPerFrame: number;
  framesPerSecond: number;
}

// Enhanced peaks result
interface PeaksAnalysisResult extends BaseAnalysisResult {
  positions: Float32Array;       // Sample positions
  amplitudes: Float32Array;      // Peak amplitudes
  times: Float32Array;          // Time stamps (seconds)
  maxAmplitude: number;
  averageAmplitude: number;
  count: number;
}

// Unified RMS result
interface RMSAnalysisResult extends BaseAnalysisResult {
  value: number;                 // RMS value
  valueDB?: number;             // Optional dB value
  channel: number;              // Processed channel
}
```

## Utility Functions

New utility functions for common audio processing tasks:

```typescript
import { toMono, sliceAudio, normalizeAudio } from 'audio-inspect/core/utils';

// Convert stereo to mono
const monoAudio = toMono(stereoAudio);

// Slice audio by time
const audioSlice = sliceAudio(audio, {
  startTime: 10.5,  // Start at 10.5 seconds
  endTime: 25.0,    // End at 25 seconds
  channel: 0        // Process specific channel
});

// Normalize audio amplitude
const normalizedAudio = normalizeAudio(audio, {
  channel: -1,      // -1 for all channels
  targetPeak: 0.9,  // Target peak amplitude
  method: 'peak'    // 'peak' or 'rms'
});
```

## Enhanced Error Handling

```typescript
import { AudioInspectError, createError } from 'audio-inspect';

try {
  const result = await someAnalysisFunction(audio);
} catch (error) {
  if (error instanceof AudioInspectError) {
    console.log('Error code:', error.code);
    console.log('Details:', error.details);
    console.log('Timestamp:', error.timestamp);
    
    // Serialize error for logging
    const serialized = error.toJSON();
    console.log('Serialized error:', JSON.stringify(serialized, null, 2));
  }
}

// Create custom errors
const customError = createError('INVALID_INPUT', 'Custom error message', { additionalData: 'value' });
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

// Traditional peak detection (legacy API)
const peaks = getPeaks(audio, { 
  count: 10, 
  threshold: 0.5,
  minDistance: 441 // Minimum distance between peaks
});

// Enhanced peak detection (new API)
const peaksAnalysis = getPeaksAnalysis(audio, {
  count: 10,
  threshold: 0.5,
  channel: 0,
  onProgress: (percent, message) => console.log(`${percent}%: ${message}`)
});

// Waveform extraction (60 FPS)
const waveform = getWaveform(audio, {
  framesPerSecond: 60,
  method: 'rms', // 'rms' | 'peak' | 'average'
  channel: 0
});

// Enhanced waveform analysis
const waveformAnalysis = getWaveformAnalysis(audio, {
  frameCount: 3600, // 1 minute at 60 FPS
  channel: 0,
  onProgress: (percent, message) => console.log(`${percent}%: ${message}`)
});

console.log(peaks.peaks); // Legacy: Array of detected peaks
console.log(peaksAnalysis.positions); // New: Float32Array of positions
console.log(peaksAnalysis.amplitudes); // New: Float32Array of amplitudes
console.log(waveformAnalysis.amplitudes); // New: Float32Array for direct visualization
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
import { getPeaksAnalysis, getWaveformAnalysis } from 'audio-inspect/features/time';

// Frequency domain only
import { getFFT, getSpectrum } from 'audio-inspect/features/frequency';

// Audio features only
import { getLUFS } from 'audio-inspect/features/loudness';
import { getVAD } from 'audio-inspect/features/vad';

// Core utilities only
import { FFTProviderFactory } from 'audio-inspect/core/fft-provider';
import { analyzeAll } from 'audio-inspect/core/batch';
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

#### `analyzeAll(audio, options)`

Batch processing for multiple analysis features with parallel execution.

```typescript
const batchResult = await analyzeAll(audio, {
  waveform: { frameCount: 1000 },
  peaks: { count: 50, threshold: 0.1 },
  rms: { channel: 0 },
  spectrum: { fftSize: 2048 },
  energy: { windowSize: 0.1 },
  onProgress: (percent, currentTask) => {
    console.log(`Processing: ${percent}% (${currentTask})`);
  }
});
```

### Enhanced Time Domain Analysis

#### `getWaveformAnalysis(audio, options?)`

Extract waveform data with Float32Array results and progress callbacks.

```typescript
const waveformResult = getWaveformAnalysis(audio, {
  frameCount: 3600,     // Number of frames to generate
  channel: 0,           // Target channel
  onProgress: (percent, message) => console.log(`${percent}%: ${message}`)
});

// Returns WaveformAnalysisResult with Float32Array amplitudes
console.log(waveformResult.amplitudes); // Float32Array for direct visualization
console.log(waveformResult.frameCount); // 3600
console.log(waveformResult.processingTime); // Processing time in ms
```

#### `getPeaksAnalysis(audio, options?)`

High-performance peak detection with Float32Array results.

```typescript
const peaksResult = getPeaksAnalysis(audio, {
  count: 100,          // Maximum number of peaks
  threshold: 0.1,      // Detection threshold (0-1)
  channel: 0,          // Target channel
  onProgress: (percent, message) => console.log(`${percent}%: ${message}`)
});

// Returns PeaksAnalysisResult with Float32Array results
console.log(peaksResult.positions);    // Float32Array of sample positions
console.log(peaksResult.amplitudes);  // Float32Array of peak amplitudes
console.log(peaksResult.times);       // Float32Array of time stamps
console.log(peaksResult.count);       // Actual number of peaks found
```

#### `getRMSAnalysis(audio, options?)`

Unified RMS analysis interface.

```typescript
const rmsResult = getRMSAnalysis(audio, {
  channel: 0,           // Target channel
  asDB: true,           // Return dB value
  reference: 1.0,       // Reference level for dB calculation
  onProgress: (percent, message) => console.log(`${percent}%: ${message}`)
});

// Returns RMSAnalysisResult
console.log(rmsResult.value);    // RMS value
console.log(rmsResult.valueDB);  // dB value (if asDB: true)
console.log(rmsResult.channel);  // Processed channel
```

### Legacy APIs (Still Supported)

#### `getPeaks(audio, options?)` - Legacy API

Traditional peak detection for backward compatibility.

```typescript
const peaks = getPeaks(audio, {
  count: 100,          // Maximum number of peaks
  threshold: 0.1,      // Detection threshold (0-1)
  channel: 0,          // Target channel (-1 for average)
  minDistance: 441     // Minimum distance between peaks
});

// Returns legacy format with object arrays
console.log(peaks.peaks); // Array of {time, amplitude} objects
```

#### `getWaveform(audio, options?)` - Legacy API

Traditional waveform extraction.

```typescript
const waveform = getWaveform(audio, {
  framesPerSecond: 60,  // Temporal resolution
  channel: 0,           // Target channel
  method: 'rms'         // 'rms' | 'peak' | 'average'
});

// Returns legacy format with object arrays
console.log(waveform.waveform); // Array of {time, amplitude} objects
```

#### `getRMS(audio, options?)` - Legacy API

Traditional RMS calculation.

```typescript
const rms = getRMS(audio, {
  channel: 0,           // Target channel
  asDB: false,          // Return in dB
  reference: 1.0        // Reference level for dB calculation
});

// Returns simple number
console.log(rms); // RMS value as number
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

### ✅ Implemented Features (v0.0.1-beta.0)

- **Enhanced Data Structures**
  - Float32Array-based results for optimal performance
  - Redesigned type system with BaseAnalysisResult interface
  - Enhanced error handling with timestamps and structured details

- **Core Functions**
  - `load` - Audio loading with sample rate conversion
  - `analyze` - Feature extraction framework
  - `analyzeAll` - Batch processing with parallel execution

- **Real-time Audio Analysis**
  - `createAudioInspectNode` - AudioWorklet-based real-time analysis
  - `AudioInspectNode` - Custom AudioNode with real-time capabilities
  - Real-time feature extraction with dynamic configuration

- **Enhanced Time Domain Analysis**
  - `getWaveformAnalysis` - Float32Array waveform with progress callbacks
  - `getPeaksAnalysis` - High-performance peak detection
  - `getRMSAnalysis` - Unified RMS interface
  - Legacy APIs maintained for backward compatibility

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

- **Utility Functions**
  - `toMono` - Stereo to mono conversion
  - `sliceAudio` - Time-based audio slicing
  - `normalizeAudio` - Amplitude normalization

- **Core Infrastructure**
  - Multiple FFT providers (WebFFT/Native)
  - Sample rate conversion (OfflineAudioContext)
  - Tree-shaking support
  - Comprehensive error handling with AudioInspectError

### 🚧 Planned Features

- `stream` - High-level streaming API wrapper (v0.2.0)
- Enhanced Node.js support (v0.3.0)
- MFCC (Mel-Frequency Cepstral Coefficients)
- Advanced pitch detection algorithms
- Audio similarity analysis

## Test Results

The library is thoroughly tested with comprehensive test coverage:

- **Total Tests**: 226 tests passing (13 test files)
- **E2E Tests**: 1 test passing (AudioInspectNode integration)
- **Test Coverage**: ~52% overall with focus on critical functionality
- **Quality Focus**: High-quality tests for essential features
- **Real-time Testing**: AudioWorklet testing with Playwright

### Recent Improvements (v0.0.1-beta.0)

**Enhanced Data Structure Implementation**:
1. ✅ Float32Array-based results for all analysis functions
2. ✅ Progress callback system for long-running operations
3. ✅ Batch processing with parallel execution and weighted progress
4. ✅ Unified error handling with AudioInspectError class
5. ✅ Utility functions for common audio processing tasks

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

# Run E2E tests
npm run test:e2e
```

### Development Commands

```bash
# Watch mode for development
npm run dev

# Clean and rebuild
npm run clean && npm run build

# Run all quality checks
npm run format && npm run type-check && npm run lint:fix
```

## Real-time Processing Features

- ✅ **AudioInspectNode**: Custom AudioNode with real-time analysis
- ✅ **AudioWorklet Integration**: Low-latency audio processing
- ✅ **Dynamic Configuration**: Runtime parameter updates
- ✅ **Event System**: Both callback and CustomEvent support
- ✅ **Batch Processing**: Parallel analysis with progress reporting
- 🚧 **Stream API**: High-level wrapper for easier integration (planned v0.2.0)

## Contributing

We welcome contributions! Please see our [GitHub repository](https://github.com/romot-co/audio-inspect) for more information.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
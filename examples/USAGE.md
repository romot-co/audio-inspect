# Audio Inspect Examples - Usage Guide

This guide explains how to properly integrate Audio Inspect library into your own projects based on the examples provided.

## 🚀 Getting Started

### 1. Installation

```bash
# Install the library
npm install audio-inspect
```

### 2. Build Setup

Make sure your build system is configured to handle ES modules and TypeScript declarations.

#### For Vite/Rollup:
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      external: ['audio-inspect']
    }
  }
}
```

#### For Webpack:
```javascript
// webpack.config.js
module.exports = {
  externals: {
    'audio-inspect': 'AudioInspect'
  }
}
```

### 3. Library Import

```javascript
// Method 1: ES Modules (recommended)
import AudioInspect from 'audio-inspect';

// Method 2: CommonJS
const AudioInspect = require('audio-inspect');

// Method 3: Global script (for HTML pages)
// <script src="node_modules/audio-inspect/dist/index.js"></script>
```

## 📝 Implementation Patterns

### Basic Audio Analysis

```javascript
import AudioInspect from 'audio-inspect';

class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.stream = null;
    this.audioInspectNode = null;
  }

  async initialize() {
    // 1. Create AudioContext
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // 2. Get microphone access
    this.stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      } 
    });
    
    // 3. Create MediaStreamSource
    this.source = this.audioContext.createMediaStreamSource(this.stream);
  }

  async startAnalysis(featureName, options = {}) {
    // 4. Register AudioWorklet
    await this.audioContext.audioWorklet.addModule('./AudioInspectProcessor.js');
    
    // 5. Create AudioInspectNode
    this.audioInspectNode = new AudioInspect.AudioInspectNode(this.audioContext, {
      featureName: featureName,
      bufferSize: 2048,
      hopSize: 1024,
      inputChannelCount: 1,
      ...options
    });
    
    // 6. Connect audio graph
    this.source.connect(this.audioInspectNode);
    
    // 7. Listen for results
    this.audioInspectNode.addEventListener('analysisResult', (event) => {
      console.log('Analysis result:', event.data);
    });
    
    // 8. Listen for errors
    this.audioInspectNode.addEventListener('error', (event) => {
      console.error('Analysis error:', event.message);
    });
  }

  stopAnalysis() {
    if (this.audioInspectNode) {
      this.source.disconnect(this.audioInspectNode);
      this.audioInspectNode.dispose();
      this.audioInspectNode = null;
    }
  }

  cleanup() {
    this.stopAnalysis();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
```

### File Analysis (Offline)

```javascript
import AudioInspect from 'audio-inspect';

// Load and analyze audio file
async function analyzeAudioFile(file) {
  try {
    // Load audio file
    const audioData = await AudioInspect.load(file, {
      sampleRate: 48000,  // Optional: resample
      normalize: true     // Optional: normalize volume
    });
    
    // Perform various analyses
    const results = {
      // Time domain
      rms: AudioInspect.getRMS(audioData),
      peaks: AudioInspect.getPeaks(audioData, { count: 10 }),
      zeroCrossing: AudioInspect.getZeroCrossing(audioData),
      
      // Frequency domain
      fft: await AudioInspect.getFFT(audioData, { 
        fftSize: 2048,
        provider: 'native'  // Use native FFT (default)
      }),
      spectrum: await AudioInspect.getSpectrum(audioData),
      
      // Spectral features
      spectralFeatures: await AudioInspect.getSpectralFeatures(audioData),
      mfcc: await AudioInspect.getMFCC(audioData, { numCoeffs: 13 }),
      
      // Loudness
      lufs: AudioInspect.getLUFS(audioData, {
        channelMode: 'stereo',
        calculateShortTerm: true,
        calculateMomentary: true,
        calculateLoudnessRange: true
      }),
      
      // Voice Activity Detection
      vad: AudioInspect.getVAD(audioData),
      
      // Stereo analysis (for stereo files)
      stereo: audioData.numberOfChannels >= 2 ? 
        AudioInspect.getStereoAnalysis(audioData) : null
    };
    
    return results;
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}
```

### Realtime LUFS Monitoring

```javascript
import AudioInspect from 'audio-inspect';

class LUFSMonitor {
  constructor(sampleRate = 48000) {
    this.processor = AudioInspect.getLUFSRealtime(sampleRate, {
      channelMode: 'stereo',
      maxDurationMs: 30000  // Keep 30 seconds of history
    });
  }

  processAudioChunk(leftChannel, rightChannel) {
    const chunk = [leftChannel, rightChannel];
    const result = this.processor.process(chunk);
    
    return {
      integrated: result.integrated,   // Integrated loudness (gated)
      momentary: result.momentary,     // Momentary loudness (400ms)
      shortTerm: result.shortTerm      // Short-term loudness (3s)
    };
  }

  reset() {
    this.processor.reset();
  }
}
```

## 🎛️ Configuration Options

### Common Options

```javascript
// AudioInspectNode options
const nodeOptions = {
  featureName: 'getRMS',          // Feature function to use
  bufferSize: 2048,               // Analysis buffer size
  hopSize: 1024,                  // Frame hop size
  inputChannelCount: 1,           // Number of input channels
  featureOptions: {               // Feature-specific options
    // Feature-dependent options go here
  }
};
```

### Feature-Specific Options

```javascript
// FFT Analysis
const fftOptions = {
  fftSize: 2048,                  // FFT size (power of 2)
  windowFunction: 'hann',         // Window function
  provider: 'native',             // FFT provider ('native' or 'webfft')
  enableProfiling: false          // Enable performance profiling
};

// Peak Detection
const peakOptions = {
  threshold: 0.3,                 // Minimum peak amplitude
  minDistance: 100,               // Minimum distance between peaks
  count: 10                       // Maximum number of peaks
};

// LUFS Measurement
const lufsOptions = {
  channelMode: 'stereo',          // 'mono' or 'stereo'
  calculateShortTerm: true,       // Calculate short-term loudness
  calculateMomentary: true,       // Calculate momentary loudness
  calculateLoudnessRange: true,   // Calculate loudness range
  calculateTruePeak: true         // Calculate true peak
};

// Voice Activity Detection
const vadOptions = {
  energyThreshold: 0.01,          // Energy threshold
  minSpeechDuration: 200,         // Minimum speech duration (ms)
  minSilenceDuration: 300,        // Minimum silence duration (ms)
  frameSize: 1024                 // Analysis frame size
};

// Stereo Analysis
const stereoOptions = {
  calculateCorrelation: true,     // Calculate cross-correlation
  calculatePhaseCoherence: true,  // Calculate phase coherence
  windowSize: 2048               // Analysis window size
};
```

## 🔧 Error Handling

```javascript
class RobustAudioAnalyzer {
  async startAnalysis(featureName) {
    try {
      await this.initialize();
      await this.startAnalysis(featureName);
    } catch (error) {
      this.handleError(error);
    }
  }

  handleError(error) {
    if (error.code === 'MICROPHONE_ACCESS_DENIED') {
      console.error('Microphone access denied');
      // Show user-friendly message
    } else if (error.code === 'AUDIOWORKLET_NOT_SUPPORTED') {
      console.error('AudioWorklet not supported');
      // Fallback to alternative implementation
    } else if (error.code === 'FFT_PROVIDER_ERROR') {
      console.error('FFT provider failed, using fallback');
      // Automatically handled by library fallback
    } else {
      console.error('Unexpected error:', error);
    }
  }
}
```

## 🚀 Performance Tips

### 1. Choose Appropriate Buffer Sizes
```javascript
// Larger buffer = more stable, higher latency
{ bufferSize: 4096, hopSize: 2048 }  // Stable, ~85ms latency

// Smaller buffer = less stable, lower latency  
{ bufferSize: 1024, hopSize: 512 }   // Responsive, ~21ms latency
```

### 2. Use Native FFT Provider
```javascript
// Native provider is now the default and more reliable
const fftOptions = {
  provider: 'native'  // Better compatibility than 'webfft'
};
```

### 3. Limit Analysis Frequency
```javascript
// Don't analyze every frame for expensive operations
let frameCount = 0;
node.addEventListener('analysisResult', (event) => {
  if (frameCount++ % 10 === 0) {  // Analyze every 10th frame
    processResult(event.data);
  }
});
```

### 4. Dispose Resources Properly
```javascript
// Always clean up resources
window.addEventListener('beforeunload', () => {
  analyzer.cleanup();
});
```

## 📚 Next Steps

1. **Explore Examples**: Check out the demo files in this directory
2. **Read Documentation**: See the main README for API details
3. **Run Tests**: `npm test` to understand expected behavior
4. **Join Community**: Report issues and contribute on GitHub

---

For more detailed information, check the [library documentation](../README.md) and [API reference](../docs/).
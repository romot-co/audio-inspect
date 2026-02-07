# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.6] - 2026-02-07

### Changed

- **Major API redesign (vNext draft aligned)**:
  - Standardized high-level public API around `load`, `analyze`, `inspect`, `monitor`, `prepareWorklet`
  - Updated typing model with `FeatureInput`, `SelectedFeatureIds`, and improved generic inference
  - Added `ChannelSelector` (`'mix' | 'all' | number[] | number`) support across analysis options
  - Added/normalized `FeatureRegistry` aliases (`RMSOptions`, `FFTResult`, `SpectrumResult`, `MFCCWithDeltaOptions`, `StereoOptions`, etc.)
- **Realtime API cleanup**:
  - Removed non-spec `provider` option from `monitor()` options
  - Removed legacy `MonitorDataEvent` export alias in favor of `MonitorFrame`
  - Clarified monitor lifecycle behavior (`close()` terminal, `INVALID_STATE` on post-close mutation)
- **Error model alignment**:
  - Removed `FFT_PROVIDER_ERROR`; provider init failures now use `INITIALIZATION_FAILED`
  - Simplified `AudioInspectError` shape to spec-aligned fields (`code`, `details`, `cause`)
- **Examples overhaul**:
  - Consolidated HTML demos into a single unified page (`examples/index.html`) covering mic + file workflows
  - Removed legacy/duplicated demo pages and obsolete demo scripts

### Removed

- Legacy internal surfaces and obsolete artifacts no longer used by vNext API path:
  - `src/core/stream.ts`, `src/core/batch.ts`
  - old E2E page/type scaffolding (`test/e2e/test-page.html`, `test/e2e/global.d.ts`)
  - old stream test (`test/core/stream.test.ts`)

### Fixed

- `getFFT()` now validates non-power-of-two FFT size up front and returns clear `INVALID_INPUT`
- Lint/type safety issues around channel selector handling in core utils
- Browser worklet URL resolution path for realtime module loading in current build flow

### Tests

- Added missing coverage for previously untested core scenarios:
  - Features: `mfccWithDelta`, `stereo`, `timeVaryingStereo`
  - Error codes: `ABORTED`, `INVALID_STATE`, `DECODE_BACKEND_MISSING`,
    `INITIALIZATION_FAILED`, `WORKLET_NOT_SUPPORTED`, `MODULE_LOAD_FAILED`,
    `INSUFFICIENT_DATA`, `MEMORY_ERROR`
  - `AbortSignal` behavior in `load`, `analyze`, `inspect`
  - `inspect()` with non-`AudioLike` sources (`Blob`, `URL`, file-path string)
  - `ChannelSelector` paths (`'mix'`, `'all'`, `number[]`)

## [0.0.4] - 2025-08-07

### Fixed

#### Critical Bug Fixes ⭐⭐⭐

- **Critical**: Fixed `filterFrequencyRange()` returning only last element when minFrequency exceeds Nyquist frequency
  - Now properly returns empty arrays for invalid frequency ranges instead of slice(-1) behavior
  - Prevents spectrum analysis from returning near-silence results
- **Critical**: Fixed `createAudioInspectNode()` crashes with "AudioWorklet module not found" error
  - Added automatic AudioWorklet module registration using `getDefaultProcessorUrl()`
  - README examples now work without manual module registration
- **Critical**: Fixed AudioContext memory leak in `load()` function hitting Chrome's 6-context limit
  - Implemented singleton AudioContext pattern with proper cleanup
  - Prevents "error allocating audio context resources" on 7th+ load
- **Critical**: Fixed A/K-weighting filter coefficients mutation via reference passing
  - Filter functions now return deep copies to prevent cache corruption
  - External coefficient modification no longer affects subsequent calls
- **Critical**: Fixed RealtimeLUFSProcessor division by zero when sampleRate < 2000Hz
  - Added blockSize validation with descriptive error messages
  - Prevents crashes in IoT/8kHz audio applications

#### Performance Improvements ⭐⭐

- **Major**: Optimized `getTimeVaryingSpectralFeatures()` performance by 20x+
  - Now reuses single FFT provider across all frames instead of creating new provider per frame
  - Reduced import overhead and memory allocation in spectral analysis workflows

#### Memory Management ⭐⭐

- **Enhanced**: Verified all FFT provider disposal code paths use proper try/finally patterns
  - All providers now support safe double-dispose operations
- **Fixed**: Added missing cleanup interval setup in AudioInspectNode mock mode for Node.js environments

#### API Usability Enhancements ⭐

- **Added**: `'stereo'` option to `channels` parameter in `load()` options (alongside existing `1|'mono'|2`)
- **Added**: Explicit `'none'` case handling in all window functions (frequency, energy, spectral)
- **Added**: `'blackman'` window function option to `EnergyOptions.windowFunction`
- **Added**: Validation for `oversample()` factor - now restricted to `[2,4,8]` for guaranteed sinc interpolation quality

### Technical Details

- All fixes maintain 100% backward compatibility with existing APIs
- Enhanced error messages provide clearer debugging information for invalid parameters  
- Improved memory efficiency in real-time processing scenarios
- Comprehensive test coverage with 340 passing tests validating all fixes

## [0.0.3] - 2025-07-24

### Fixed

- **Critical**: Fixed RealtimeLUFSProcessor sample counting bug where `sampleCount` was incorrectly incremented per channel instead of per frame
  - In stereo mode, this caused buffer positions to advance 2x faster than intended
  - This fix ensures correct LUFS gating timing and measurement accuracy per ITU-R BS.1770-5 specification
  - Restructured processing loop to synchronize sample counting across all channels
  - Improved measurement precision while maintaining all existing test compatibility

### Technical Details

- The bug affected the 400ms block overlap calculation required for proper LUFS gating
- Fixed synchronization between channel processing and block boundary detection
- Enhanced buffer management to handle multi-channel audio more consistently

## [0.0.2] - 2025-06-14

### Changed

- Enhanced package.json metadata for stable release
- Improved AudioInspectProcessor buffer handling and stereo coherence calculation

### Added

- Stable release preparation with comprehensive metadata

## [0.0.1] - 2025-06-12

### Added

- Initial stable release
- Complete audio analysis library with comprehensive features

### Documentation

- Updated README for stable 0.0.1 release
- Code formatting with Prettier

## [0.0.1-beta.6] - 2025-06-11

### Added

- Important fixes and examples addition based on REVIEW.md feedback
- Enhanced LUFS Realtime processing
- Improved STFT/iSTFT implementation
- Performance test enhancements

### Changed

- IEC 61672-1:2013 compliant A-weighting and K-weighting filter implementation
- E2E test improvements

## [0.0.1-beta.3] - 2025-05-31

### Optimized

- Additional optimizations and compression
- Package size reduced by 79%
- Performance improvements across all analysis functions

## Features Overview

### Core Analysis Features

- **Time Domain**: RMS, Peak detection, Zero-crossing rate, Waveform analysis
- **Frequency Domain**: FFT, Spectrum analysis, MFCC, Spectral features
- **Loudness**: LUFS measurement (ITU-R BS.1770-5 compliant), A/K-weighting filters
- **Audio Quality**: True peak detection, Crest factor, Dynamic range
- **Advanced**: STFT/iSTFT, Voice Activity Detection (VAD), Stereo analysis
- **Real-time**: AudioWorklet-based streaming analysis

### Standards Compliance

- **IEC 61672-1:2013**: A-weighting filter implementation
- **ITU-R BS.1770-5**: K-weighting and LUFS measurement
- **EBU R128**: Loudness normalization standards

### Supported Environments

- Modern browsers with Web Audio API support
- Node.js environments
- TypeScript and JavaScript
- ES modules and CommonJS

### Performance

- Optimized for real-time processing
- WebAssembly acceleration where available
- Memory-efficient buffer management
- Comprehensive test coverage (73%+)

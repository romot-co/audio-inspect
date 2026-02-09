# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.7] - 2026-02-09

### Added

- New spectral features:
  - `melSpectrogram` (framed mel-band representation with optional log scaling)
  - `cqt` (FFT-based constant-Q style log-frequency representation)
- New dedicated stereo feature tests (`test/features/stereo.test.ts`).

### Changed

- `timeVaryingStereo` is now implemented and returns frame-wise `times/correlation/width/balance` data.
- `stereo` phase analysis now computes and returns `phaseCorrelation`.
- `stereo` coherence calculation updated to time-averaged MSC (Magnitude-Squared Coherence).
- FFT provider/windowing logic is now centralized via `src/core/dsp/fft-runtime.ts` and reused across frequency/spectral/stereo paths.
- Added runtime-level FFT provider cache DI (`FFTProviderCacheStore`) and reused it in `analyze`, `monitor`, and `src/core/realtime/processor.ts`.
- Worklet-side analysis now injects processor-level FFT runtime deps (provider + cache) into FFT-backed feature options.
- `getStereoAnalysis()` now supports provider DI (`provider` / `enableProfiling`) and reuses a single provider during phase/coherence analysis.
- Built-in feature defaults now align with API spec: `channel` default is `'mix'` (mono downmix) across time/frequency/spectral/energy/vad/dynamics paths.
- `analyze()` now executes selected features concurrently (Promise-based) while preserving per-feature progress callbacks.
- Feature registry now includes and exposes `rmsAnalysis`, `peaksAnalysis`, and `waveformAnalysis` through `analyze`/`inspect`.
- Hot-path loops now avoid per-sample defensive normalization in core feature processing (`time`/`spectral`/`stereo`/`loudness`/`energy`/`vad`/`dynamics`), with finite-value filtering retained only where API semantics require it (RMS invalid-sample handling).
- Window generation is now cached and reused via `src/core/dsp/window.ts`; framed FFT paths now reuse frame buffers instead of allocating per frame.
- `NativeFFTProvider` now reuses internal scratch buffers and precomputed frequency bins across calls.

### Fixed

- `getLUFS({ calculateTruePeak: true })` now uses oversampled true-peak estimation (dBTP-oriented) instead of raw sample peak.
- `getLUFS()` true-peak oversampling parameters are now configurable (`truePeakOversamplingFactor`, `truePeakInterpolation`) instead of hardcoded.
- `getMFCC()` no longer recreates FFT providers per frame; it now reuses a single provider across all frames.
- `analyze(..., { features: { timeVaryingStereo: true } })` no longer reports `UNSUPPORTED_FORMAT` for built-in implementation.
- `getTimeVaryingSpectralFeatures()` now computes ZCR from raw frame data, eliminating zero-padding-induced false crossings.
- `getLUFS()` short-term/momentary series now run at 100ms hop-equivalent chunking instead of sparse 500ms snapshots.
- Realtime `lufs` in `monitor()` is now stateful (integrated/momentary/short-term continuity preserved across frames) in the single-worklet path.
- `getSpectrum({ timeFrames > 1 })` now returns representative non-empty `magnitudes` instead of an always-empty array.
- `AudioInspectError.code` and `createError()` now use the `ErrorCode` union type (type-safe, no arbitrary string codes).
- `getSpectralFeatures()` now always sets `spectralFlux` (single-frame semantics are `0`, not `undefined`).
- `getTruePeak()` now computes oversampled peak in a streaming manner without building a full oversampled buffer.
- A/K-weighting coefficient caches no longer deep-copy per call; `applyAWeighting()` now runs as a single-buffer pipeline instead of allocating one buffer per biquad stage.
- Browser decode path now reuses a shared `AudioContext` for `decodeAudioData` instead of creating/closing one context per load.
- `getFFT()` now deduplicates in-flight identical requests (same audio + options), reducing duplicate computation under parallel feature execution.

### Removed

- Legacy channel sentinel `-1` support in `getChannelData()` (use `'mix'`).
- Backward-compatible numeric overload style for `getRMS(audio, channelNumber)` (use options object: `getRMS(audio, { channel })`).

### Tests

- Updated `analyze` integration expectation for `timeVaryingStereo`.
- Added test coverage for:
  - `getMelSpectrogram`
  - `getCQT`
  - stereo coherence/phase-correlation behavior
  - working `getTimeVaryingStereoAnalysis`
  - ZCR zero-padding regression in `getTimeVaryingSpectralFeatures`
  - representative `magnitudes` in spectrogram-mode `getSpectrum`
  - LUFS short-term/momentary time-series resolution
  - realtime LUFS state continuity via registry runtime injection
  - FFT provider cache reuse across repeated FFT calls
  - analyze-path integration for `rmsAnalysis` / `peaksAnalysis` / `waveformAnalysis`
  - `'mix'` default channel behavior in `getRMS`

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

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
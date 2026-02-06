import * as AudioInspect from '../dist/index.js';

const BAND_DEFS = [
  { id: 'sub', label: 'Sub', minHz: 20, maxHz: 60 },
  { id: 'bass', label: 'Bass', minHz: 60, maxHz: 250 },
  { id: 'lowmid', label: 'LowMid', minHz: 250, maxHz: 1000 },
  { id: 'highmid', label: 'HighMid', minHz: 1000, maxHz: 4000 },
  { id: 'air', label: 'Air', minHz: 4000, maxHz: 12000 }
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const elements = {
  modeMicBtn: document.getElementById('modeMicBtn'),
  modeFileBtn: document.getElementById('modeFileBtn'),
  micPanel: document.getElementById('micPanel'),
  filePanel: document.getElementById('filePanel'),
  startMicBtn: document.getElementById('startMicBtn'),
  stopMicBtn: document.getElementById('stopMicBtn'),
  fileInput: document.getElementById('fileInput'),
  filePlayer: document.getElementById('filePlayer'),
  fileMetaName: document.getElementById('fileMetaName'),
  fileMetaDuration: document.getElementById('fileMetaDuration'),
  fileMetaRate: document.getElementById('fileMetaRate'),
  fileMetaChannels: document.getElementById('fileMetaChannels'),
  fftSize: document.getElementById('fftSize'),
  frequencyScale: document.getElementById('frequencyScale'),
  displayMaxHz: document.getElementById('displayMaxHz'),
  smoothing: document.getElementById('smoothing'),
  smoothingValue: document.getElementById('smoothingValue'),
  minDb: document.getElementById('minDb'),
  maxDb: document.getElementById('maxDb'),
  captureBtn: document.getElementById('captureBtn'),
  resetStatsBtn: document.getElementById('resetStatsBtn'),
  runOfflineBtn: document.getElementById('runOfflineBtn'),
  offlineNormalize: document.getElementById('offlineNormalize'),
  offlineChecks: Array.from(document.querySelectorAll('[data-offline-analysis]')),
  offlineStatus: document.getElementById('offlineStatus'),
  liveStatusBadge: document.getElementById('liveStatusBadge'),
  metricSource: document.getElementById('metricSource'),
  metricRms: document.getElementById('metricRms'),
  metricPeak: document.getElementById('metricPeak'),
  metricDominant: document.getElementById('metricDominant'),
  metricCentroid: document.getElementById('metricCentroid'),
  metricZcr: document.getElementById('metricZcr'),
  metricPitch: document.getElementById('metricPitch'),
  metricNote: document.getElementById('metricNote'),
  metricSpeechRatio: document.getElementById('metricSpeechRatio'),
  metricMomentary: document.getElementById('metricMomentary'),
  metricShortTerm: document.getElementById('metricShortTerm'),
  metricIntegrated: document.getElementById('metricIntegrated'),
  metricTruePeak: document.getElementById('metricTruePeak'),
  metricHeadroom: document.getElementById('metricHeadroom'),
  metricClipCount: document.getElementById('metricClipCount'),
  metricCorrelation: document.getElementById('metricCorrelation'),
  metricStereoWidth: document.getElementById('metricStereoWidth'),
  metricStereoBalance: document.getElementById('metricStereoBalance'),
  spectrumCanvas: document.getElementById('spectrumCanvas'),
  waterfallCanvas: document.getElementById('waterfallCanvas'),
  waveformCanvas: document.getElementById('waveformCanvas'),
  stereoCanvas: document.getElementById('stereoCanvas'),
  vadCanvas: document.getElementById('vadCanvas'),
  mfccCanvas: document.getElementById('mfccCanvas'),
  snapshotList: document.getElementById('snapshotList'),
  offlineResults: document.getElementById('offlineResults'),
  rawJson: document.getElementById('rawJson')
};

const state = {
  sourceMode: 'mic',
  liveSource: 'none',
  audioContext: null,
  masterAnalyser: null,
  leftAnalyser: null,
  rightAnalyser: null,
  fileOutputGain: null,
  analysisSink: null,
  lufsProcessor: null,
  micStream: null,
  micSourceNode: null,
  micSplitter: null,
  fileSourceNode: null,
  fileSplitter: null,
  fileConnected: false,
  file: null,
  objectUrl: null,
  loadedAudioData: null,
  loadedAudioKey: null,
  freqData: new Float32Array(0),
  timeData: new Float32Array(0),
  leftTimeData: new Float32Array(0),
  rightTimeData: new Float32Array(0),
  prevLinearSpectrum: new Float32Array(0),
  rafId: 0,
  lastFrameMs: 0,
  lastMetrics: null,
  snapshots: [],
  clipCount: 0,
  wasClipping: false,
  noiseFloor: 0,
  vadHistory: [],
  lastVadUpdateMs: 0,
  lastPitchHz: 0,
  lastPitchUpdateMs: 0,
  mfccHistory: [],
  lastMfccUpdateMs: 0,
  melFilterBank: null,
  melFilterKey: ''
};

const OFFLINE_ANALYSES = {
  rms: {
    title: 'RMS / Peak / Crest',
    run: async (_audio, monoAudio) => {
      const rmsLinear = AudioInspect.getRMS(monoAudio, { asDB: false });
      const rmsDb = AudioInspect.getRMS(monoAudio, { asDB: true });
      const peakLinear = AudioInspect.getPeakAmplitude(monoAudio, { asDB: false });
      const peakDb = AudioInspect.getPeakAmplitude(monoAudio, { asDB: true });
      const crest = AudioInspect.getCrestFactor(monoAudio, { method: 'simple' });
      return { rmsLinear, rmsDb, peakLinear, peakDb, crest };
    },
    metrics: (value) => [
      ['RMS', formatNumber(value.rmsLinear, 5)],
      ['RMS (dBFS)', formatNumber(value.rmsDb, 2)],
      ['Peak', formatNumber(value.peakLinear, 5)],
      ['Peak (dBFS)', formatNumber(value.peakDb, 2)],
      ['Crest', `${formatNumber(value.crest.crestFactor, 2)} dB`]
    ]
  },
  spectrum: {
    title: 'Spectrum',
    run: async (_audio, monoAudio) =>
      AudioInspect.getSpectrum(monoAudio, {
        fftSize: Number(elements.fftSize.value),
        minFrequency: 20,
        maxFrequency: monoAudio.sampleRate / 2,
        decibels: true,
        timeFrames: 1,
        provider: 'native',
        channel: 0
      }),
    metrics: (value) => {
      const dominant = findDominantFrequency(value.frequencies, value.magnitudes);
      return [
        ['Bins', String(value.frequencies.length)],
        ['Dominant', `${formatNumber(dominant.frequency, 1)} Hz`],
        ['Magnitude', formatNumber(dominant.magnitude, 5)]
      ];
    }
  },
  spectral: {
    title: 'Spectral Features',
    run: async (_audio, monoAudio) =>
      AudioInspect.getSpectralFeatures(monoAudio, {
        fftSize: Number(elements.fftSize.value),
        minFrequency: 20,
        maxFrequency: monoAudio.sampleRate / 2,
        rolloffThreshold: 0.85,
        channel: 0
      }),
    metrics: (value) => [
      ['Centroid', `${formatNumber(value.spectralCentroid, 2)} Hz`],
      ['Bandwidth', `${formatNumber(value.spectralBandwidth, 2)} Hz`],
      ['Rolloff', `${formatNumber(value.spectralRolloff, 2)} Hz`],
      ['Flatness', formatNumber(value.spectralFlatness, 4)],
      ['ZCR', formatNumber(value.zeroCrossingRate, 5)]
    ]
  },
  lufs: {
    title: 'Loudness (LUFS)',
    run: async (audio) =>
      AudioInspect.getLUFS(audio, {
        channelMode: audio.numberOfChannels >= 2 ? 'stereo' : 'mono',
        gated: true,
        calculateMomentary: true,
        calculateShortTerm: true,
        calculateLoudnessRange: true,
        calculateTruePeak: true
      }),
    metrics: (value) => [
      ['Integrated', `${formatNumber(value.integrated, 2)} LUFS`],
      ['LRA', value.loudnessRange == null ? 'n/a' : `${formatNumber(value.loudnessRange, 2)} LU`],
      ['Momentary', String(value.momentary?.length ?? 0)],
      ['Short-term', String(value.shortTerm?.length ?? 0)]
    ]
  },
  vad: {
    title: 'VAD',
    run: async (_audio, monoAudio) =>
      AudioInspect.getVAD(monoAudio, {
        method: 'adaptive',
        frameSizeMs: 30,
        hopSizeMs: 10,
        smoothing: true,
        minSpeechDurationMs: 120,
        minSilenceDurationMs: 250
      }),
    metrics: (value) => {
      const speechSegments = value.segments.filter((seg) => seg.type === 'speech');
      const speechDuration = speechSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      return [
        ['Segments', String(value.segments.length)],
        ['Speech Segments', String(speechSegments.length)],
        ['Speech Ratio', `${formatNumber(value.speechRatio * 100, 2)}%`],
        ['Speech Duration', `${formatNumber(speechDuration, 3)} s`]
      ];
    }
  },
  mfcc: {
    title: 'MFCC',
    run: async (_audio, monoAudio) =>
      AudioInspect.getMFCC(monoAudio, {
        frameSizeMs: 25,
        hopSizeMs: 10,
        numMelFilters: 32,
        numMfccCoeffs: 13,
        windowFunction: 'hamming',
        preEmphasis: 0.97,
        lifterCoeff: 22,
        minFrequency: 20,
        maxFrequency: monoAudio.sampleRate / 2,
        channel: 0
      }),
    metrics: (value) => {
      const first = value.mfcc[0] ?? [];
      return [
        ['Frames', String(value.frameInfo.numFrames)],
        ['Coefficients', String(value.frameInfo.numCoeffs)],
        ['Head', first.slice(0, 4).map((v) => formatNumber(v, 3)).join(', ') || 'n/a']
      ];
    }
  }
};

init();

function init() {
  elements.modeMicBtn.addEventListener('click', () => setMode('mic'));
  elements.modeFileBtn.addEventListener('click', () => setMode('file'));
  elements.startMicBtn.addEventListener('click', () => {
    void startMic();
  });
  elements.stopMicBtn.addEventListener('click', () => stopMic());
  elements.fileInput.addEventListener('change', (event) => {
    void onFileSelected(event);
  });
  elements.filePlayer.addEventListener('play', () => {
    void onFilePlay();
  });
  elements.filePlayer.addEventListener('pause', onFilePause);
  elements.filePlayer.addEventListener('ended', onFileEnded);
  elements.filePlayer.addEventListener('loadedmetadata', onFileMetadataLoaded);
  elements.captureBtn.addEventListener('click', captureSnapshot);
  elements.resetStatsBtn.addEventListener('click', resetRealtimeStats);
  elements.runOfflineBtn.addEventListener('click', () => {
    void runOfflineAnalysis();
  });

  elements.fftSize.addEventListener('change', onRealtimeSettingChanged);
  elements.frequencyScale.addEventListener('change', onRealtimeSettingChanged);
  elements.displayMaxHz.addEventListener('change', onRealtimeSettingChanged);
  elements.smoothing.addEventListener('input', onRealtimeSettingChanged);
  elements.minDb.addEventListener('change', onRealtimeSettingChanged);
  elements.maxDb.addEventListener('change', onRealtimeSettingChanged);

  window.addEventListener('resize', drawIdleCanvases);
  window.addEventListener('beforeunload', cleanupResources);

  setMode('mic');
  onRealtimeSettingChanged();
  updateMetricCards(null);
  updateBandMeters(null);
  drawIdleCanvases();
}

function setMode(mode) {
  state.sourceMode = mode;

  const isMic = mode === 'mic';
  elements.modeMicBtn.classList.toggle('active', isMic);
  elements.modeFileBtn.classList.toggle('active', !isMic);
  elements.modeMicBtn.setAttribute('aria-selected', isMic ? 'true' : 'false');
  elements.modeFileBtn.setAttribute('aria-selected', isMic ? 'false' : 'true');
  elements.micPanel.classList.toggle('hidden', !isMic);
  elements.filePanel.classList.toggle('hidden', isMic);

  if (isMic) {
    if (!elements.filePlayer.paused) {
      elements.filePlayer.pause();
    }

    if (state.micStream) {
      state.liveSource = 'mic';
      setLiveStatus('Microphone active', 'ok');
      startRenderLoop();
    } else {
      state.liveSource = 'none';
      setLiveStatus('Mic mode ready', 'warn');
    }
  } else {
    stopMic({ keepStatus: true });
    if (state.file) {
      state.liveSource = elements.filePlayer.paused ? 'none' : 'file';
      setLiveStatus(elements.filePlayer.paused ? 'File mode ready' : 'File playback active', elements.filePlayer.paused ? 'warn' : 'ok');
      if (state.liveSource === 'file') {
        startRenderLoop();
      }
    } else {
      state.liveSource = 'none';
      setLiveStatus('File mode (select file)', 'warn');
    }
  }
}

function onRealtimeSettingChanged() {
  elements.smoothingValue.textContent = formatNumber(Number(elements.smoothing.value), 2);
  applyAnalyserSettings();
}

function resetRealtimeStats() {
  state.clipCount = 0;
  state.wasClipping = false;
  state.noiseFloor = 0;
  state.vadHistory = [];
  state.lastVadUpdateMs = 0;
  state.mfccHistory = [];
  state.lastMfccUpdateMs = 0;
  state.lastPitchHz = 0;
  state.lastPitchUpdateMs = 0;
  state.lastFrameMs = 0;

  if (state.lufsProcessor && typeof state.lufsProcessor.reset === 'function') {
    state.lufsProcessor.reset();
  }
}

async function startMic() {
  try {
    setMode('mic');
    await ensureAudioGraph();
    stopMic({ keepStatus: true });

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('このブラウザはマイク入力に対応していません。');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const source = state.audioContext.createMediaStreamSource(stream);
    const splitter = state.audioContext.createChannelSplitter(2);

    source.connect(state.masterAnalyser);
    source.connect(splitter);
    splitter.connect(state.leftAnalyser, 0);
    splitter.connect(state.rightAnalyser, 1);

    state.micStream = stream;
    state.micSourceNode = source;
    state.micSplitter = splitter;
    state.liveSource = 'mic';

    elements.startMicBtn.disabled = true;
    elements.stopMicBtn.disabled = false;

    setLiveStatus('Microphone active', 'ok');
    startRenderLoop();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setLiveStatus(`Mic error: ${message}`, 'error');
  }
}

function stopMic(options = {}) {
  const { keepStatus = false } = options;
  const wasLiveMic = state.liveSource === 'mic';

  if (state.micSplitter) {
    try {
      state.micSplitter.disconnect();
    } catch {
      // noop
    }
    state.micSplitter = null;
  }

  if (state.micSourceNode) {
    try {
      state.micSourceNode.disconnect();
    } catch {
      // noop
    }
    state.micSourceNode = null;
  }

  if (state.micStream) {
    for (const track of state.micStream.getTracks()) {
      track.stop();
    }
    state.micStream = null;
  }

  elements.startMicBtn.disabled = false;
  elements.stopMicBtn.disabled = true;

  if (wasLiveMic) {
    state.liveSource = 'none';
  }

  if (!keepStatus && wasLiveMic) {
    setLiveStatus('Microphone stopped', 'warn');
  }
}

async function onFileSelected(event) {
  const file = event.target.files?.[0] ?? null;
  state.file = file;
  state.loadedAudioData = null;
  state.loadedAudioKey = null;

  clearOfflineResults();
  elements.rawJson.textContent = '{}';

  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  if (!file) {
    elements.filePlayer.removeAttribute('src');
    elements.fileMetaName.textContent = '-';
    elements.fileMetaDuration.textContent = '-';
    elements.fileMetaRate.textContent = '-';
    elements.fileMetaChannels.textContent = '-';
    elements.runOfflineBtn.disabled = true;
    setOfflineStatus('ファイル未選択です。', 'warn');

    if (state.liveSource === 'file') {
      state.liveSource = 'none';
      setLiveStatus('File cleared', 'warn');
    }
    return;
  }

  setFileMetaFromFile(file);
  setOfflineStatus('再生でリアルタイム監視、Runでオフライン解析を実行できます。', 'ok');
  elements.runOfflineBtn.disabled = false;

  state.objectUrl = URL.createObjectURL(file);
  elements.filePlayer.src = state.objectUrl;
  setMode('file');

  try {
    await ensureAudioGraph();
    connectFileMonitor();
    setLiveStatus('File loaded. Press play.', 'warn');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setLiveStatus(`File setup error: ${message}`, 'error');
  }
}

async function onFilePlay() {
  if (!state.file) {
    return;
  }

  try {
    await ensureAudioGraph();
    connectFileMonitor();
    state.liveSource = 'file';
    setLiveStatus('File playback active', 'ok');
    startRenderLoop();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setLiveStatus(`Playback error: ${message}`, 'error');
  }
}

function onFilePause() {
  if (state.liveSource === 'file') {
    state.liveSource = 'none';
    setLiveStatus('File paused', 'warn');
  }
}

function onFileEnded() {
  if (state.liveSource === 'file') {
    state.liveSource = 'none';
    setLiveStatus('File ended', 'warn');
  }
}

function onFileMetadataLoaded() {
  const duration = elements.filePlayer.duration;
  elements.fileMetaDuration.textContent = Number.isFinite(duration) ? `${formatNumber(duration, 2)} s` : '-';
}

async function ensureAudioGraph() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('Web Audio API is not supported.');
  }

  if (!state.audioContext) {
    state.audioContext = new AudioContextCtor();
    state.masterAnalyser = state.audioContext.createAnalyser();
    state.leftAnalyser = state.audioContext.createAnalyser();
    state.rightAnalyser = state.audioContext.createAnalyser();
    state.fileOutputGain = state.audioContext.createGain();
    state.analysisSink = state.audioContext.createGain();
    state.fileOutputGain.gain.value = 1;
    state.analysisSink.gain.value = 0;
    state.fileOutputGain.connect(state.audioContext.destination);
    state.analysisSink.connect(state.audioContext.destination);
    state.masterAnalyser.connect(state.analysisSink);
    state.leftAnalyser.connect(state.analysisSink);
    state.rightAnalyser.connect(state.analysisSink);
    state.lufsProcessor = AudioInspect.getLUFSRealtime(state.audioContext.sampleRate, {
      channelMode: 'mono',
      gated: true,
      maxDurationMs: 60000
    });
  }

  if (state.audioContext.state === 'suspended') {
    await state.audioContext.resume();
  }

  applyAnalyserSettings();
}

function applyAnalyserSettings() {
  if (!state.masterAnalyser || !state.leftAnalyser || !state.rightAnalyser || !state.audioContext) {
    return;
  }

  const fftSize = normalizeFFTSize(Number(elements.fftSize.value));
  const smoothing = clamp(Number(elements.smoothing.value), 0, 0.98);
  const minDb = Number.isFinite(Number(elements.minDb.value)) ? Number(elements.minDb.value) : -100;
  const maxDbRaw = Number.isFinite(Number(elements.maxDb.value)) ? Number(elements.maxDb.value) : -16;
  const maxDb = Math.max(minDb + 8, maxDbRaw);

  elements.minDb.value = String(minDb);
  elements.maxDb.value = String(maxDb);

  for (const analyser of [state.masterAnalyser, state.leftAnalyser, state.rightAnalyser]) {
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothing;
    analyser.minDecibels = minDb;
    analyser.maxDecibels = maxDb;
  }

  state.freqData = new Float32Array(state.masterAnalyser.frequencyBinCount);
  state.timeData = new Float32Array(state.masterAnalyser.fftSize);
  state.leftTimeData = new Float32Array(state.leftAnalyser.fftSize);
  state.rightTimeData = new Float32Array(state.rightAnalyser.fftSize);
  state.prevLinearSpectrum = new Float32Array(state.masterAnalyser.frequencyBinCount);

  const maxHz = Math.min(Number(elements.displayMaxHz.value) || 12000, state.audioContext.sampleRate / 2);
  const melKey = `${state.audioContext.sampleRate}:${state.masterAnalyser.fftSize}:${maxHz}:${state.masterAnalyser.frequencyBinCount}`;
  if (state.melFilterKey !== melKey) {
    state.melFilterBank = createMelFilterBank(
      26,
      state.masterAnalyser.frequencyBinCount,
      state.audioContext.sampleRate,
      20,
      maxHz
    );
    state.melFilterKey = melKey;
  }
}

function connectFileMonitor() {
  if (!state.audioContext || !state.masterAnalyser || !state.leftAnalyser || !state.rightAnalyser || !state.fileOutputGain) {
    return;
  }

  if (!state.fileSourceNode) {
    state.fileSourceNode = state.audioContext.createMediaElementSource(elements.filePlayer);
  }

  if (state.fileConnected) {
    return;
  }

  const splitter = state.audioContext.createChannelSplitter(2);
  state.fileSourceNode.connect(state.masterAnalyser);
  state.fileSourceNode.connect(splitter);
  splitter.connect(state.leftAnalyser, 0);
  splitter.connect(state.rightAnalyser, 1);
  state.fileSourceNode.connect(state.fileOutputGain);

  state.fileSplitter = splitter;
  state.fileConnected = true;
}

function startRenderLoop() {
  if (state.rafId !== 0) {
    return;
  }

  const tick = () => {
    renderRealtimeFrame();

    if (state.liveSource !== 'none') {
      state.rafId = window.requestAnimationFrame(tick);
    } else {
      state.rafId = 0;
      drawIdleCanvases();
      updateMetricCards(null);
      updateBandMeters(null);
    }
  };

  state.rafId = window.requestAnimationFrame(tick);
}

function renderRealtimeFrame() {
  if (!state.masterAnalyser || !state.audioContext) {
    return;
  }

  state.masterAnalyser.getFloatFrequencyData(state.freqData);
  state.masterAnalyser.getFloatTimeDomainData(state.timeData);

  if (state.leftAnalyser && state.rightAnalyser) {
    state.leftAnalyser.getFloatTimeDomainData(state.leftTimeData);
    state.rightAnalyser.getFloatTimeDomainData(state.rightTimeData);
  }

  const nowMs = performance.now();
  const dtSec =
    state.lastFrameMs > 0 ? Math.max(1 / 120, (nowMs - state.lastFrameMs) / 1000) : state.timeData.length / state.audioContext.sampleRate;
  state.lastFrameMs = nowMs;

  const leftLevel = computeSignalLevel(state.leftTimeData);
  const rightLevel = computeSignalLevel(state.rightTimeData);
  const masterLevel = computeSignalLevel(state.timeData);

  let scopeLeft = state.leftTimeData;
  let scopeRight = state.rightTimeData;
  let scopeMode = 'stereo';

  if (leftLevel < 1e-5 && masterLevel >= 1e-5) {
    scopeLeft = state.timeData;
  }

  if (rightLevel < 1e-5) {
    scopeRight = scopeLeft;
    scopeMode = 'mono';
  }

  const recentSamples = extractRecentSamples(state.timeData, state.audioContext.sampleRate, dtSec);
  const metrics = calculateRealtimeMetrics(
    recentSamples,
    state.timeData,
    state.freqData,
    scopeLeft,
    scopeRight,
    state.audioContext.sampleRate,
    state.masterAnalyser.fftSize,
    nowMs
  );

  state.lastMetrics = metrics;

  updateMetricCards(metrics);
  updateBandMeters(metrics.bands);

  drawSpectrum(metrics);
  drawWaterfall();
  drawWaveform(state.timeData);
  drawStereoScope(scopeLeft, scopeRight, metrics.stereo, scopeMode);
  drawVadTimeline();
  drawMfccHeatmap();
}

function calculateRealtimeMetrics(
  recentSamples,
  fullFrame,
  freqData,
  leftSamples,
  rightSamples,
  sampleRate,
  fftSize,
  nowMs
) {
  const activeSamples = recentSamples.length > 0 ? recentSamples : fullFrame;

  let sumSquares = 0;
  let peak = 0;
  let zeroCrossings = 0;
  let prevSign = 0;

  for (let i = 0; i < activeSamples.length; i++) {
    const sample = ensureFinite(activeSamples[i] ?? 0);
    sumSquares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));

    const sign = Math.sign(sample);
    if (i > 0 && sign !== 0 && prevSign !== 0 && sign !== prevSign) {
      zeroCrossings += 1;
    }
    if (sign !== 0) {
      prevSign = sign;
    }
  }

  const rms = activeSamples.length > 0 ? Math.sqrt(sumSquares / activeSamples.length) : 0;
  const rmsDb = linearToDb(rms);
  const peakDb = linearToDb(peak);
  const zcr = activeSamples.length > 1 ? zeroCrossings / (activeSamples.length - 1) : 0;

  const config = getSpectrumDisplayConfig(sampleRate);
  const minBin = frequencyToBinIndex(config.minHz, sampleRate, fftSize, freqData.length);
  const maxBin = frequencyToBinIndex(config.maxHz, sampleRate, fftSize, freqData.length);

  let dominantIndex = minBin;
  let dominantDb = -Infinity;
  let weightedFreq = 0;
  let totalMag = 0;

  for (let i = minBin; i <= maxBin; i++) {
    const db = ensureFinite(freqData[i] ?? -Infinity);
    if (db > dominantDb) {
      dominantDb = db;
      dominantIndex = i;
    }

    const linearMag = Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
    const freq = (i * sampleRate) / fftSize;
    weightedFreq += freq * linearMag;
    totalMag += linearMag;

    const prev = state.prevLinearSpectrum[i] ?? 0;
    state.prevLinearSpectrum[i] = linearMag;
    void prev;
  }

  const dominantHz = (dominantIndex * sampleRate) / fftSize;
  const centroidHz = totalMag > 1e-12 ? weightedFreq / totalMag : 0;

  const bands = BAND_DEFS.map((band) => {
    const lo = frequencyToBinIndex(band.minHz, sampleRate, fftSize, freqData.length);
    const hi = frequencyToBinIndex(Math.min(band.maxHz, sampleRate / 2), sampleRate, fftSize, freqData.length);

    let sum = 0;
    let count = 0;

    for (let i = lo; i <= hi; i++) {
      const db = ensureFinite(freqData[i] ?? -Infinity);
      const linear = Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
      sum += linear;
      count += 1;
    }

    const linearAvg = count > 0 ? sum / count : 0;
    const dbValue = linearToDb(linearAvg);
    const norm = clamp((dbValue - Number(elements.minDb.value)) / Math.max(1, Number(elements.maxDb.value) - Number(elements.minDb.value)), 0, 1);

    return {
      id: band.id,
      db: dbValue,
      norm
    };
  });

  let momentary = -Infinity;
  let shortTerm = -Infinity;
  let integrated = -Infinity;
  if (state.lufsProcessor) {
    const lufsResult = state.lufsProcessor.process([recentSamples]);
    momentary = lufsResult.momentary;
    shortTerm = lufsResult.shortTerm;
    integrated = lufsResult.integrated;
  }

  const truePeakLinear = estimateTruePeakLinear(activeSamples, 4);
  const truePeakDb = linearToDb(truePeakLinear);
  const headroomDb = Number.isFinite(truePeakDb) ? -truePeakDb : Infinity;
  const clipping = truePeakLinear >= 1.0;
  if (clipping && !state.wasClipping) {
    state.clipCount += 1;
  }
  state.wasClipping = clipping;

  const speech = updateVad(rms, zcr, nowMs);
  const speechRatio = state.vadHistory.length > 0 ? state.vadHistory.reduce((sum, item) => sum + item, 0) / state.vadHistory.length : 0;

  const stereo = computeStereoMetrics(leftSamples, rightSamples);

  if (nowMs - state.lastPitchUpdateMs >= 120) {
    state.lastPitchHz = estimatePitchHz(activeSamples, sampleRate);
    state.lastPitchUpdateMs = nowMs;
  }

  if (nowMs - state.lastMfccUpdateMs >= 110) {
    const mfcc = computeFrameMfcc(freqData, sampleRate, fftSize);
    if (mfcc.length > 0) {
      state.mfccHistory.push(mfcc);
      if (state.mfccHistory.length > 140) {
        state.mfccHistory.shift();
      }
    }
    state.lastMfccUpdateMs = nowMs;
  }

  return {
    source: state.liveSource,
    rmsDb,
    peakDb,
    dominantHz,
    centroidHz,
    zcr,
    momentary,
    shortTerm,
    integrated,
    truePeakDb,
    headroomDb,
    clipCount: state.clipCount,
    speech,
    speechRatio,
    pitchHz: state.lastPitchHz,
    note: state.lastPitchHz > 0 ? frequencyToNote(state.lastPitchHz) : null,
    stereo,
    bands
  };
}

function updateVad(rms, zcr, nowMs) {
  if (state.noiseFloor <= 0) {
    state.noiseFloor = rms;
  }

  if (rms < state.noiseFloor * 1.1) {
    state.noiseFloor = state.noiseFloor * 0.98 + rms * 0.02;
  } else {
    state.noiseFloor = state.noiseFloor * 0.995 + rms * 0.005;
  }

  const threshold = Math.max(0.0015, state.noiseFloor * 2.2);
  const speech = rms > threshold && zcr > 0.01 && zcr < 0.3;

  if (nowMs - state.lastVadUpdateMs >= 100) {
    state.vadHistory.push(speech ? 1 : 0);
    if (state.vadHistory.length > 240) {
      state.vadHistory.shift();
    }
    state.lastVadUpdateMs = nowMs;
  }

  return speech;
}

function computeStereoMetrics(left, right) {
  const length = Math.min(left.length, right.length);
  if (length < 128) {
    return null;
  }

  let sumL = 0;
  let sumR = 0;
  let sumLR = 0;
  let sumL2 = 0;
  let sumR2 = 0;
  let energyL = 0;
  let energyR = 0;
  let energyMid = 0;
  let energySide = 0;

  for (let i = 0; i < length; i++) {
    const l = ensureFinite(left[i] ?? 0);
    const r = ensureFinite(right[i] ?? 0);
    sumL += l;
    sumR += r;
    sumLR += l * r;
    sumL2 += l * l;
    sumR2 += r * r;
    energyL += l * l;
    energyR += r * r;

    const mid = (l + r) * 0.5;
    const side = (l - r) * 0.5;
    energyMid += mid * mid;
    energySide += side * side;
  }

  if (energyL + energyR < 1e-10) {
    return null;
  }

  const meanL = sumL / length;
  const meanR = sumR / length;
  const covariance = sumLR / length - meanL * meanR;
  const stdL = Math.sqrt(Math.max(0, sumL2 / length - meanL * meanL));
  const stdR = Math.sqrt(Math.max(0, sumR2 / length - meanR * meanR));
  const correlation = stdL > 1e-10 && stdR > 1e-10 ? covariance / (stdL * stdR) : 0;
  const width = energyMid + energySide > 1e-10 ? energySide / (energyMid + energySide) : 0;
  const balance = (energyR - energyL) / (energyL + energyR);

  return { correlation, width, balance };
}

function computeFrameMfcc(freqData, sampleRate, fftSize) {
  if (!state.melFilterBank || state.melFilterBank.length === 0) {
    return [];
  }

  const powerSpectrum = new Float64Array(freqData.length);
  for (let i = 0; i < freqData.length; i++) {
    const db = freqData[i];
    const mag = Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
    powerSpectrum[i] = mag * mag;
  }

  const melEnergies = new Float64Array(state.melFilterBank.length);
  for (let i = 0; i < state.melFilterBank.length; i++) {
    const filter = state.melFilterBank[i];
    let sum = 0;
    for (let j = 0; j < filter.length && j < powerSpectrum.length; j++) {
      sum += powerSpectrum[j] * filter[j];
    }
    melEnergies[i] = Math.log(Math.max(sum, 1e-12));
  }

  const numCoeffs = 13;
  const coeffs = new Array(numCoeffs).fill(0);
  const N = melEnergies.length;
  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += melEnergies[n] * Math.cos((Math.PI * k * (n + 0.5)) / N);
    }
    const norm = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    coeffs[k] = sum * norm;
  }

  return coeffs;
}

function estimatePitchHz(samples, sampleRate) {
  const frameSize = Math.min(samples.length, 2048);
  if (frameSize < 512) {
    return 0;
  }

  const frame = samples.slice(samples.length - frameSize);
  let mean = 0;
  for (let i = 0; i < frame.length; i++) {
    mean += frame[i];
  }
  mean /= frame.length;

  for (let i = 0; i < frame.length; i++) {
    frame[i] -= mean;
  }

  let energy = 0;
  for (let i = 0; i < frame.length; i++) {
    energy += frame[i] * frame[i];
  }
  if (energy / frame.length < 1e-5) {
    return 0;
  }

  const minLag = Math.max(2, Math.floor(sampleRate / 1000));
  const maxLag = Math.min(frame.length - 2, Math.floor(sampleRate / 70));
  let bestLag = 0;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let numerator = 0;
    let normA = 0;
    let normB = 0;
    const limit = frame.length - lag;
    for (let i = 0; i < limit; i++) {
      const a = frame[i];
      const b = frame[i + lag];
      numerator += a * b;
      normA += a * a;
      normB += b * b;
    }

    const denom = Math.sqrt(normA * normB) + 1e-12;
    const corr = numerator / denom;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag === 0 || bestCorr < 0.25) {
    return 0;
  }

  return sampleRate / bestLag;
}

function frequencyToNote(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null;
  }

  const midi = 69 + 12 * Math.log2(frequency / 440);
  const rounded = Math.round(midi);
  const note = NOTE_NAMES[(rounded % 12 + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  const cents = Math.round((midi - rounded) * 100);
  const centsLabel = cents === 0 ? '' : ` ${cents > 0 ? '+' : ''}${cents}c`;
  return `${note}${octave}${centsLabel}`;
}

function updateMetricCards(metrics) {
  if (!metrics) {
    elements.metricSource.textContent = sourceLabel(state.liveSource);
    elements.metricRms.textContent = '-';
    elements.metricPeak.textContent = '-';
    elements.metricDominant.textContent = '-';
    elements.metricCentroid.textContent = '-';
    elements.metricZcr.textContent = '-';
    elements.metricPitch.textContent = '-';
    elements.metricNote.textContent = '-';
    elements.metricSpeechRatio.textContent = '-';
    elements.metricMomentary.textContent = '-';
    elements.metricShortTerm.textContent = '-';
    elements.metricIntegrated.textContent = '-';
    elements.metricTruePeak.textContent = '-';
    elements.metricHeadroom.textContent = '-';
    elements.metricClipCount.textContent = '0';
    elements.metricCorrelation.textContent = '-';
    elements.metricStereoWidth.textContent = '-';
    elements.metricStereoBalance.textContent = '-';
    return;
  }

  elements.metricSource.textContent = sourceLabel(metrics.source);
  elements.metricRms.textContent = `${formatNumber(metrics.rmsDb, 1)} dBFS`;
  elements.metricPeak.textContent = `${formatNumber(metrics.peakDb, 1)} dBFS`;
  elements.metricDominant.textContent = `${formatNumber(metrics.dominantHz, 1)} Hz`;
  elements.metricCentroid.textContent = `${formatNumber(metrics.centroidHz, 1)} Hz`;
  elements.metricZcr.textContent = formatNumber(metrics.zcr, 4);
  elements.metricPitch.textContent = metrics.pitchHz > 0 ? `${formatNumber(metrics.pitchHz, 1)} Hz` : 'n/a';
  elements.metricNote.textContent = metrics.note ?? 'n/a';
  elements.metricSpeechRatio.textContent = `${formatNumber(metrics.speechRatio * 100, 1)}%`;
  elements.metricMomentary.textContent = Number.isFinite(metrics.momentary) ? `${formatNumber(metrics.momentary, 1)} LUFS` : 'n/a';
  elements.metricShortTerm.textContent = Number.isFinite(metrics.shortTerm) ? `${formatNumber(metrics.shortTerm, 1)} LUFS` : 'n/a';
  elements.metricIntegrated.textContent = Number.isFinite(metrics.integrated) ? `${formatNumber(metrics.integrated, 1)} LUFS` : 'n/a';
  elements.metricTruePeak.textContent = Number.isFinite(metrics.truePeakDb) ? `${formatNumber(metrics.truePeakDb, 1)} dBTP` : 'n/a';
  elements.metricHeadroom.textContent = Number.isFinite(metrics.headroomDb) ? `${formatNumber(metrics.headroomDb, 1)} dB` : 'n/a';
  elements.metricClipCount.textContent = String(metrics.clipCount);
  elements.metricCorrelation.textContent = metrics.stereo ? formatNumber(metrics.stereo.correlation, 3) : 'n/a';
  elements.metricStereoWidth.textContent = metrics.stereo ? formatNumber(metrics.stereo.width, 3) : 'n/a';
  elements.metricStereoBalance.textContent = metrics.stereo ? formatNumber(metrics.stereo.balance, 3) : 'n/a';
}

function updateBandMeters(bands) {
  for (const band of BAND_DEFS) {
    const fill = document.getElementById(`band_${band.id}_fill`);
    const value = document.getElementById(`band_${band.id}_val`);
    if (!fill || !value) {
      continue;
    }

    if (!bands) {
      fill.style.width = '0%';
      value.textContent = '-';
      continue;
    }

    const bandData = bands.find((item) => item.id === band.id);
    if (!bandData) {
      fill.style.width = '0%';
      value.textContent = '-';
      continue;
    }

    fill.style.width = `${Math.round(bandData.norm * 100)}%`;
    value.textContent = Number.isFinite(bandData.db) ? `${formatNumber(bandData.db, 1)} dB` : 'n/a';
  }
}

function drawSpectrum(metrics) {
  const canvas = elements.spectrumCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx || !state.masterAnalyser || !state.audioContext) {
    return;
  }

  fitCanvasToDisplay(canvas);

  const width = canvas.width;
  const height = canvas.height;
  const minDb = state.masterAnalyser.minDecibels;
  const maxDb = state.masterAnalyser.maxDecibels;
  const config = getSpectrumDisplayConfig(state.audioContext.sampleRate);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0e0e12';
  ctx.fillRect(0, 0, width, height);

  drawFrequencyGrid(ctx, width, height, config);

  ctx.strokeStyle = '#dcdce1';
  ctx.lineWidth = 1.2;
  ctx.beginPath();

  for (let x = 0; x < width; x++) {
    const freq = xToFrequency(x, width, config);
    const idx = frequencyToBinIndex(
      freq,
      state.audioContext.sampleRate,
      state.masterAnalyser.fftSize,
      state.freqData.length
    );
    const db = clamp(state.freqData[idx] ?? minDb, minDb, maxDb);
    const ratio = clamp((db - minDb) / Math.max(1e-6, maxDb - minDb), 0, 1);
    const y = height - ratio * height;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  if (Number.isFinite(metrics.dominantHz) && metrics.dominantHz > 0) {
    const markerX = frequencyToX(metrics.dominantHz, width, config);
    ctx.strokeStyle = '#9a9aa4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(markerX, 0);
    ctx.lineTo(markerX, height);
    ctx.stroke();
  }
}

function drawFrequencyGrid(ctx, width, height, config) {
  const ticks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 16000, 20000];
  ctx.strokeStyle = 'rgba(180, 180, 190, 0.12)';
  ctx.fillStyle = 'rgba(180, 180, 190, 0.68)';
  ctx.lineWidth = 1;
  ctx.font = '11px "Avenir Next", sans-serif';

  for (const hz of ticks) {
    if (hz < config.minHz || hz > config.maxHz) {
      continue;
    }

    const x = frequencyToX(hz, width, config);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : String(hz), x + 2, height - 8);
  }

  for (let i = 1; i < 5; i++) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawWaterfall() {
  const canvas = elements.waterfallCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx || !state.masterAnalyser || !state.audioContext) {
    return;
  }

  fitCanvasToDisplay(canvas);

  const width = canvas.width;
  const height = canvas.height;
  const minDb = state.masterAnalyser.minDecibels;
  const maxDb = state.masterAnalyser.maxDecibels;
  const config = getSpectrumDisplayConfig(state.audioContext.sampleRate);

  ctx.drawImage(canvas, 0, 0, width, height - 1, 0, 1, width, height - 1);
  const row = ctx.createImageData(width, 1);

  for (let x = 0; x < width; x++) {
    const freq = xToFrequency(x, width, config);
    const idx = frequencyToBinIndex(
      freq,
      state.audioContext.sampleRate,
      state.masterAnalyser.fftSize,
      state.freqData.length
    );
    const db = clamp(state.freqData[idx] ?? minDb, minDb, maxDb);
    const ratio = clamp((db - minDb) / Math.max(1e-6, maxDb - minDb), 0, 1);
    const value = Math.round(18 + ratio * 220);
    const pos = x * 4;
    row.data[pos] = value;
    row.data[pos + 1] = value;
    row.data[pos + 2] = value;
    row.data[pos + 3] = 255;
  }

  ctx.putImageData(row, 0, 0);
}

function drawWaveform(timeData) {
  const canvas = elements.waveformCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  fitCanvasToDisplay(canvas);

  const width = canvas.width;
  const height = canvas.height;
  const centerY = height / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0e0e12';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(170, 170, 180, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();

  ctx.strokeStyle = '#efeff3';
  ctx.lineWidth = 1.2;
  ctx.beginPath();

  for (let x = 0; x < width; x++) {
    const idx = Math.floor((x / Math.max(1, width - 1)) * (timeData.length - 1));
    const sample = ensureFinite(timeData[idx] ?? 0);
    const y = centerY - sample * (height * 0.42);
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

function drawStereoScope(leftData, rightData, stereoMetrics, scopeMode = 'stereo') {
  const canvas = elements.stereoCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  fitCanvasToDisplay(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) * 0.42;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0e0e12';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(170, 170, 180, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, height);
  ctx.moveTo(0, cy);
  ctx.lineTo(width, cy);
  ctx.moveTo(cx - scale, cy - scale);
  ctx.lineTo(cx + scale, cy + scale);
  ctx.moveTo(cx - scale, cy + scale);
  ctx.lineTo(cx + scale, cy - scale);
  ctx.stroke();

  const length = Math.min(leftData.length, rightData.length);
  if (length < 32) {
    ctx.fillStyle = 'rgba(190, 190, 198, 0.68)';
    ctx.font = '13px "Avenir Next", sans-serif';
    ctx.fillText('Stereo data unavailable', 12, 24);
    return;
  }

  let maxEnergy = 0;
  for (let i = 0; i < length; i += 8) {
    const l = ensureFinite(leftData[i] ?? 0);
    const r = ensureFinite(rightData[i] ?? 0);
    maxEnergy = Math.max(maxEnergy, Math.abs(l), Math.abs(r));
  }

  if (maxEnergy < 1e-5) {
    ctx.fillStyle = 'rgba(190, 190, 198, 0.68)';
    ctx.font = '13px "Avenir Next", sans-serif';
    ctx.fillText('Signal too low', 12, 24);
    return;
  }

  const scopeGain = computeScopeGain(maxEnergy);
  const step = Math.max(1, Math.floor(length / 1400));
  ctx.strokeStyle = 'rgba(238, 238, 244, 0.56)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  let started = false;
  for (let i = 0; i < length; i += step) {
    const l = ensureFinite(leftData[i] ?? 0);
    const r = ensureFinite(rightData[i] ?? 0);

    const side = ((l - r) * 0.5) * scopeGain;
    const mid = ((l + r) * 0.5) * scopeGain;
    const x = cx + clamp(side, -1, 1) * scale;
    const y = cy - clamp(mid, -1, 1) * scale;

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }

    ctx.fillStyle = 'rgba(235, 235, 241, 0.24)';
    ctx.fillRect(x, y, 1, 1);
  }

  ctx.stroke();

  ctx.fillStyle = 'rgba(205, 205, 214, 0.75)';
  ctx.font = '12px "Avenir Next", sans-serif';

  if (scopeMode === 'mono') {
    ctx.fillText('Mono input (duplicated for scope)', 12, 18);
  }

  if (scopeGain > 1.05) {
    ctx.fillText(`Scope gain x${formatNumber(scopeGain, 1)}`, 12, scopeMode === 'mono' ? 34 : 18);
  }

  if (stereoMetrics && scopeMode !== 'mono') {
    ctx.font = '12px "Avenir Next", sans-serif';
    const stereoTextY = scopeGain > 1.05 ? 34 : 18;
    ctx.fillText(`Corr ${formatNumber(stereoMetrics.correlation, 3)} | Width ${formatNumber(stereoMetrics.width, 3)}`, 12, stereoTextY);
  }
}

function drawVadTimeline() {
  const canvas = elements.vadCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  fitCanvasToDisplay(canvas);
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0e0e12';
  ctx.fillRect(0, 0, width, height);

  if (state.vadHistory.length === 0) {
    ctx.fillStyle = 'rgba(190, 190, 198, 0.7)';
    ctx.font = '13px "Avenir Next", sans-serif';
    ctx.fillText('No VAD history yet', 12, 24);
    return;
  }

  const barWidth = width / state.vadHistory.length;
  for (let i = 0; i < state.vadHistory.length; i++) {
    const speech = state.vadHistory[i] === 1;
    ctx.fillStyle = speech ? '#f0f0f5' : '#2f2f37';
    ctx.fillRect(i * barWidth, 0, Math.max(1, barWidth), height);
  }

  ctx.strokeStyle = '#7f7f88';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function drawMfccHeatmap() {
  const canvas = elements.mfccCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  fitCanvasToDisplay(canvas);
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0e0e12';
  ctx.fillRect(0, 0, width, height);

  if (state.mfccHistory.length === 0) {
    ctx.fillStyle = 'rgba(190, 190, 198, 0.7)';
    ctx.font = '13px "Avenir Next", sans-serif';
    ctx.fillText('No MFCC data yet', 12, 24);
    return;
  }

  const rows = Math.min(state.mfccHistory.length, 120);
  const cols = state.mfccHistory[state.mfccHistory.length - 1]?.length ?? 13;
  if (cols <= 0) {
    return;
  }

  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let r = 0; r < rows; r++) {
    const row = state.mfccHistory[state.mfccHistory.length - 1 - r];
    if (!row) continue;
    for (let c = 0; c < cols; c++) {
      const value = row[c] ?? 0;
      minVal = Math.min(minVal, value);
      maxVal = Math.max(maxVal, value);
    }
  }

  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || Math.abs(maxVal - minVal) < 1e-8) {
    minVal = -1;
    maxVal = 1;
  }

  const rowH = height / rows;
  const colW = width / cols;

  for (let r = 0; r < rows; r++) {
    const row = state.mfccHistory[state.mfccHistory.length - 1 - r];
    if (!row) continue;

    for (let c = 0; c < cols; c++) {
      const value = row[c] ?? 0;
      const norm = clamp((value - minVal) / (maxVal - minVal), 0, 1);
      const gray = Math.round(22 + norm * 220);
      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      ctx.fillRect(c * colW, r * rowH, Math.ceil(colW), Math.ceil(rowH));
    }
  }
}

function drawIdleCanvases() {
  for (const canvas of [
    elements.spectrumCanvas,
    elements.waterfallCanvas,
    elements.waveformCanvas,
    elements.stereoCanvas,
    elements.vadCanvas,
    elements.mfccCanvas
  ]) {
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    fitCanvasToDisplay(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0e0e12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(190, 190, 198, 0.68)';
    ctx.font = '13px "Avenir Next", sans-serif';
    ctx.fillText('Waiting for signal...', 12, 24);
  }
}

function captureSnapshot() {
  if (!state.lastMetrics) {
    return;
  }

  const snap = {
    at: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
    source: sourceLabel(state.lastMetrics.source),
    rmsDb: state.lastMetrics.rmsDb,
    peakDb: state.lastMetrics.peakDb,
    dominantHz: state.lastMetrics.dominantHz,
    momentary: state.lastMetrics.momentary,
    truePeakDb: state.lastMetrics.truePeakDb,
    speechRatio: state.lastMetrics.speechRatio
  };

  state.snapshots.unshift(snap);
  if (state.snapshots.length > 30) {
    state.snapshots.pop();
  }

  renderSnapshots();
}

function renderSnapshots() {
  elements.snapshotList.innerHTML = '';

  if (state.snapshots.length === 0) {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = 'Capture Snapshot で履歴を残せます。';
    elements.snapshotList.appendChild(item);
    return;
  }

  for (const snap of state.snapshots) {
    const li = document.createElement('li');
    li.className = 'snapshot-item';
    li.innerHTML = `
      <p>${escapeHtml(snap.at)} | ${escapeHtml(snap.source)}</p>
      <p>RMS ${formatNumber(snap.rmsDb, 1)} dBFS | Peak ${formatNumber(snap.peakDb, 1)} dBFS</p>
      <p>${formatNumber(snap.dominantHz, 1)} Hz | M ${formatNumber(snap.momentary, 1)} LUFS | TP ${formatNumber(snap.truePeakDb, 1)} dBTP</p>
      <p>Speech ${formatNumber(snap.speechRatio * 100, 1)}%</p>
    `;
    elements.snapshotList.appendChild(li);
  }
}

async function runOfflineAnalysis() {
  if (!state.file) {
    setOfflineStatus('先にファイルを選択してください。', 'warn');
    return;
  }

  const selected = elements.offlineChecks
    .filter((input) => input.checked)
    .map((input) => input.dataset.offlineAnalysis)
    .filter((id) => id in OFFLINE_ANALYSES);

  if (selected.length === 0) {
    setOfflineStatus('解析項目を1つ以上選択してください。', 'warn');
    return;
  }

  elements.runOfflineBtn.disabled = true;
  clearOfflineResults();
  elements.rawJson.textContent = '{}';

  try {
    setOfflineStatus('音声データをデコード中...', 'warn');

    const loadOptions = { normalize: elements.offlineNormalize.checked };
    const loadKey = `${state.file.name}:${state.file.size}:${state.file.lastModified}:${loadOptions.normalize}`;
    if (!state.loadedAudioData || state.loadedAudioKey !== loadKey) {
      state.loadedAudioData = await AudioInspect.load(state.file, loadOptions);
      state.loadedAudioKey = loadKey;
    }

    const audio = state.loadedAudioData;
    const monoAudio = audio.numberOfChannels > 1 ? AudioInspect.toMono(audio) : audio;
    updateFileMetaFromAudio(audio);

    const result = {
      file: {
        name: state.file.name,
        sizeBytes: state.file.size,
        loadOptions
      },
      audio: {
        duration: audio.duration,
        sampleRate: audio.sampleRate,
        channels: audio.numberOfChannels,
        samples: audio.length,
        analysisChannelMode: audio.numberOfChannels > 1 ? 'mono-mix' : 'channel-0'
      },
      analyses: {}
    };

    for (let index = 0; index < selected.length; index++) {
      const id = selected[index];
      const def = OFFLINE_ANALYSES[id];
      setOfflineStatus(`${def.title} を解析中 (${index + 1}/${selected.length})...`, 'warn');

      const started = performance.now();
      try {
        const value = await def.run(audio, monoAudio);
        const elapsedMs = performance.now() - started;
        result.analyses[id] = { ok: true, elapsedMs, value };
      } catch (error) {
        const elapsedMs = performance.now() - started;
        result.analyses[id] = {
          ok: false,
          elapsedMs,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    renderOfflineResults(result.analyses);
    elements.rawJson.textContent = JSON.stringify(result, jsonReplacer, 2);

    const failed = Object.values(result.analyses).filter((entry) => !entry.ok).length;
    setOfflineStatus(
      failed > 0 ? `完了: ${selected.length - failed} 成功 / ${failed} 失敗` : `完了: ${selected.length} 項目を解析しました。`,
      failed > 0 ? 'warn' : 'ok'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setOfflineStatus(`解析エラー: ${message}`, 'error');
  } finally {
    elements.runOfflineBtn.disabled = !state.file;
  }
}

function renderOfflineResults(analyses) {
  elements.offlineResults.innerHTML = '';

  const ids = Object.keys(analyses);
  if (ids.length === 0) {
    clearOfflineResults();
    return;
  }

  for (const id of ids) {
    const entry = analyses[id];
    const def = OFFLINE_ANALYSES[id];
    const metrics = entry.ok ? def.metrics(entry.value) : [['Error', entry.error ?? 'Unknown']];

    const metricHtml = metrics
      .map(([label, value]) => `<div><span>${escapeHtml(String(label))}</span><span>${escapeHtml(String(value))}</span></div>`)
      .join('');

    const item = document.createElement('article');
    item.className = `result-item ${entry.ok ? 'ok' : 'error'}`;
    item.innerHTML = `
      <h3>${escapeHtml(def.title)}</h3>
      <div class="meta">${escapeHtml(id)} | ${formatNumber(entry.elapsedMs, 1)} ms</div>
      <div class="metrics">${metricHtml}</div>
    `;
    elements.offlineResults.appendChild(item);
  }
}

function clearOfflineResults() {
  elements.offlineResults.innerHTML = '<p class="empty">オフライン解析結果はここに表示されます。</p>';
}

function setLiveStatus(text, level) {
  elements.liveStatusBadge.textContent = text;
  elements.liveStatusBadge.className = `badge${level ? ` ${level}` : ''}`;
}

function setOfflineStatus(text, level) {
  elements.offlineStatus.textContent = text;
  elements.offlineStatus.className = `status-line${level ? ` ${level}` : ''}`;
}

function setFileMetaFromFile(file) {
  elements.fileMetaName.textContent = `${file.name} (${formatBytes(file.size)})`;
  elements.fileMetaDuration.textContent = 'loading...';
  elements.fileMetaRate.textContent = '-';
  elements.fileMetaChannels.textContent = '-';
}

function updateFileMetaFromAudio(audio) {
  elements.fileMetaDuration.textContent = `${formatNumber(audio.duration, 3)} s`;
  elements.fileMetaRate.textContent = `${audio.sampleRate} Hz`;
  elements.fileMetaChannels.textContent = String(audio.numberOfChannels);
}

function cleanupResources() {
  if (state.rafId !== 0) {
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  stopMic({ keepStatus: true });

  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  if (state.fileSplitter) {
    try {
      state.fileSplitter.disconnect();
    } catch {
      // noop
    }
    state.fileSplitter = null;
  }

  if (state.fileSourceNode) {
    try {
      state.fileSourceNode.disconnect();
    } catch {
      // noop
    }
    state.fileSourceNode = null;
    state.fileConnected = false;
  }

  if (state.audioContext && state.audioContext.state !== 'closed') {
    void state.audioContext.close();
  }
  state.analysisSink = null;
}

function fitCanvasToDisplay(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * ratio);
  const height = Math.floor(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function extractRecentSamples(timeData, sampleRate, dtSec) {
  const fallback = Math.min(timeData.length, 1024);
  let sampleCount = Number.isFinite(dtSec) ? Math.round(sampleRate * dtSec) : fallback;
  sampleCount = Math.max(128, Math.min(timeData.length, sampleCount));
  const start = Math.max(0, timeData.length - sampleCount);
  return timeData.slice(start);
}

function computeSignalLevel(samples) {
  if (!samples || samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += Math.abs(ensureFinite(samples[i] ?? 0));
  }
  return sum / samples.length;
}

function computeScopeGain(maxEnergy) {
  if (!Number.isFinite(maxEnergy) || maxEnergy <= 0) {
    return 1;
  }
  return clamp(0.65 / maxEnergy, 1, 24);
}

function getSpectrumDisplayConfig(sampleRate) {
  const nyquist = sampleRate / 2;
  const minHz = 20;
  const scale = elements.frequencyScale.value === 'linear' ? 'linear' : 'log';
  let maxHz = Number(elements.displayMaxHz.value);
  if (!Number.isFinite(maxHz)) {
    maxHz = 12000;
  }
  maxHz = clamp(maxHz, minHz + 100, nyquist);
  elements.displayMaxHz.value = String(Math.round(maxHz));
  return { minHz, maxHz, scale };
}

function xToFrequency(x, width, config) {
  const ratio = clamp(x / Math.max(1, width - 1), 0, 1);
  if (config.scale === 'linear') {
    return config.minHz + ratio * (config.maxHz - config.minHz);
  }
  const min = Math.max(1, config.minHz);
  const logMin = Math.log10(min);
  const logMax = Math.log10(config.maxHz);
  return Math.pow(10, logMin + ratio * (logMax - logMin));
}

function frequencyToX(frequency, width, config) {
  const freq = clamp(frequency, config.minHz, config.maxHz);
  if (config.scale === 'linear') {
    const ratio = (freq - config.minHz) / Math.max(1e-6, config.maxHz - config.minHz);
    return clamp(ratio * width, 0, width);
  }
  const min = Math.max(1, config.minHz);
  const logMin = Math.log10(min);
  const logMax = Math.log10(config.maxHz);
  const ratio = (Math.log10(freq) - logMin) / Math.max(1e-6, logMax - logMin);
  return clamp(ratio * width, 0, width);
}

function frequencyToBinIndex(frequency, sampleRate, fftSize, binsLength) {
  const binWidth = sampleRate / fftSize;
  return clamp(Math.round(frequency / Math.max(1e-12, binWidth)), 0, Math.max(0, binsLength - 1));
}

function estimateTruePeakLinear(samples, oversamplingFactor = 4) {
  if (samples.length === 0) {
    return 0;
  }

  let peak = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = ensureFinite(samples[i] ?? 0);
    const b = ensureFinite(samples[i + 1] ?? 0);
    peak = Math.max(peak, Math.abs(a), Math.abs(b));

    for (let n = 1; n < oversamplingFactor; n++) {
      const t = n / oversamplingFactor;
      const interpolated = a + (b - a) * t;
      peak = Math.max(peak, Math.abs(interpolated));
    }
  }
  return peak;
}

function createMelFilterBank(numFilters, fftBins, sampleRate, minFreq, maxFreq) {
  const nyquist = sampleRate / 2;
  const safeMin = clamp(minFreq, 0, nyquist - 1);
  const safeMax = clamp(maxFreq, safeMin + 1, nyquist);

  const minMel = hzToMel(safeMin);
  const maxMel = hzToMel(safeMax);
  const melPoints = [];
  for (let i = 0; i < numFilters + 2; i++) {
    melPoints.push(minMel + ((maxMel - minMel) * i) / (numFilters + 1));
  }

  const hzPoints = melPoints.map((mel) => melToHz(mel));
  const bins = hzPoints.map((hz) =>
    clamp(Math.floor(((fftBins - 1) * hz) / nyquist), 0, fftBins - 1)
  );

  const filters = [];
  for (let m = 1; m <= numFilters; m++) {
    const filter = new Float32Array(fftBins);
    const left = bins[m - 1];
    const center = bins[m];
    const right = bins[m + 1];

    if (left === undefined || center === undefined || right === undefined) {
      continue;
    }

    for (let k = left; k <= right; k++) {
      if (k < 0 || k >= fftBins) continue;
      if (k < center) {
        const denom = center - left;
        filter[k] = denom > 0 ? (k - left) / denom : 0;
      } else {
        const denom = right - center;
        filter[k] = denom > 0 ? (right - k) / denom : 0;
      }
    }
    filters.push(filter);
  }

  return filters;
}

function hzToMel(hz) {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel) {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

function findDominantFrequency(frequencies, magnitudes) {
  let peakIndex = 0;
  let peakMagnitude = -Infinity;
  for (let i = 0; i < magnitudes.length; i++) {
    const value = ensureFinite(magnitudes[i] ?? 0);
    if (value > peakMagnitude) {
      peakMagnitude = value;
      peakIndex = i;
    }
  }
  return {
    frequency: frequencies[peakIndex] ?? 0,
    magnitude: peakMagnitude
  };
}

function sourceLabel(source) {
  if (source === 'mic') return 'Microphone';
  if (source === 'file') return 'File';
  return 'Idle';
}

function normalizeFFTSize(value) {
  const allowed = [1024, 2048, 4096, 8192];
  return allowed.includes(value) ? value : 2048;
}

function linearToDb(value) {
  if (!Number.isFinite(value) || value <= 1e-12) {
    return -Infinity;
  }
  return 20 * Math.log10(value);
}

function jsonReplacer(_key, value) {
  if (value instanceof Float32Array) {
    return {
      type: 'Float32Array',
      length: value.length,
      head: Array.from(value.slice(0, 40)).map((item) => Number(item.toFixed(6)))
    };
  }

  if (Array.isArray(value) && value.length > 80) {
    const first = value[0];
    if (typeof first === 'number') {
      return {
        type: 'number[]',
        length: value.length,
        head: value.slice(0, 40).map((item) => Number(ensureFinite(item).toFixed(6)))
      };
    }
  }

  return value;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return 'n/a';
  return Number(value).toFixed(digits);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 2 : 1)} ${units[unit]}`;
}

function ensureFinite(value) {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

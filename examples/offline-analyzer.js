import * as AudioInspect from '../dist/index.js';

const elements = {
  controlForm: document.getElementById('controlForm'),
  fileInput: document.getElementById('fileInput'),
  channelMode: document.getElementById('channelMode'),
  targetSampleRate: document.getElementById('targetSampleRate'),
  fftSize: document.getElementById('fftSize'),
  peakThreshold: document.getElementById('peakThreshold'),
  normalizeInput: document.getElementById('normalizeInput'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  clearBtn: document.getElementById('clearBtn'),
  statusLine: document.getElementById('statusLine'),
  progressBar: document.getElementById('progressBar'),
  runSummary: document.getElementById('runSummary'),
  resultGrid: document.getElementById('resultGrid'),
  rawJson: document.getElementById('rawJson'),
  metaFile: document.getElementById('metaFile'),
  metaDuration: document.getElementById('metaDuration'),
  metaRate: document.getElementById('metaRate'),
  metaChannels: document.getElementById('metaChannels'),
  audioPlayer: document.getElementById('audioPlayer'),
  waveformCanvas: document.getElementById('waveformCanvas'),
  spectrumCanvas: document.getElementById('spectrumCanvas')
};

const state = {
  file: null,
  objectUrl: null,
  audioData: null,
  lastResults: null
};

const ANALYSIS_DEFS = {
  rms: {
    title: 'RMS / Peak / Crest',
    run: async (_audio, cfg) => {
      const analysisAudio = cfg.monoAudio;
      const rmsLinear = AudioInspect.getRMS(analysisAudio, { asDB: false });
      const rmsDb = AudioInspect.getRMS(analysisAudio, { asDB: true });
      const peakLinear = AudioInspect.getPeakAmplitude(analysisAudio, { asDB: false });
      const peakDb = AudioInspect.getPeakAmplitude(analysisAudio, { asDB: true });
      const crest = AudioInspect.getCrestFactor(analysisAudio, { method: 'simple' });
      return { rmsLinear, rmsDb, peakLinear, peakDb, crest };
    },
    metrics: (value) => [
      ['RMS', formatNumber(value.rmsLinear, 5)],
      ['RMS (dBFS)', formatNumber(value.rmsDb, 2)],
      ['Peak', formatNumber(value.peakLinear, 5)],
      ['Peak (dBFS)', formatNumber(value.peakDb, 2)],
      ['Crest Factor', formatNumber(value.crest.crestFactor, 2) + ' dB']
    ]
  },
  peaks: {
    title: 'Peak Detection',
    run: async (_audio, cfg) =>
      AudioInspect.getPeaks(cfg.monoAudio, {
        count: 12,
        threshold: cfg.peakThreshold,
        minDistance: Math.floor(cfg.monoAudio.sampleRate * 0.01)
      }),
    metrics: (value) => {
      const top = value.peaks.slice(0, 3).map((p) => `${formatNumber(p.time, 3)}s @ ${formatNumber(p.amplitude, 3)}`);
      return [
        ['Detected Peaks', String(value.peaks.length)],
        ['Max Amplitude', formatNumber(value.maxAmplitude, 4)],
        ['Average Peak', formatNumber(value.averageAmplitude, 4)],
        ['Top 3', top.length > 0 ? top.join(' | ') : 'none']
      ];
    }
  },
  energy: {
    title: 'Frame Energy',
    run: async (_audio, cfg) =>
      AudioInspect.getEnergy(cfg.monoAudio, {
        frameSize: Math.floor(cfg.monoAudio.sampleRate * 0.025),
        hopSize: Math.floor(cfg.monoAudio.sampleRate * 0.01),
        windowFunction: 'hann',
        normalized: false
      }),
    metrics: (value) => [
      ['Frames', String(value.energies.length)],
      ['Total Energy', formatNumber(value.totalEnergy, 4)],
      ['Mean', formatNumber(value.statistics.mean, 4)],
      ['Std Dev', formatNumber(value.statistics.std, 4)],
      ['Range', `${formatNumber(value.statistics.min, 4)} .. ${formatNumber(value.statistics.max, 4)}`]
    ]
  },
  spectrum: {
    title: 'Spectrum',
    run: async (_audio, cfg) =>
      AudioInspect.getSpectrum(cfg.monoAudio, {
        fftSize: cfg.fftSize,
        minFrequency: 20,
        maxFrequency: cfg.monoAudio.sampleRate / 2,
        decibels: true,
        timeFrames: 1,
        provider: 'native',
        channel: 0
      }),
    metrics: (value) => {
      const dominant = findDominantFrequency(value.frequencies, value.magnitudes);
      return [
        ['Bins', String(value.frequencies.length)],
        ['Dominant Frequency', formatNumber(dominant.frequency, 1) + ' Hz'],
        ['Dominant Magnitude', formatNumber(dominant.magnitude, 5)],
        ['Min Frequency', formatNumber(value.frequencies[0] ?? 0, 1) + ' Hz'],
        ['Max Frequency', formatNumber(value.frequencies[value.frequencies.length - 1] ?? 0, 1) + ' Hz']
      ];
    }
  },
  spectral: {
    title: 'Spectral Features',
    run: async (_audio, cfg) =>
      AudioInspect.getSpectralFeatures(cfg.monoAudio, {
        fftSize: cfg.fftSize,
        minFrequency: 20,
        maxFrequency: cfg.monoAudio.sampleRate / 2,
        rolloffThreshold: 0.85,
        channel: 0
      }),
    metrics: (value) => [
      ['Centroid', formatNumber(value.spectralCentroid, 2) + ' Hz'],
      ['Bandwidth', formatNumber(value.spectralBandwidth, 2) + ' Hz'],
      ['Rolloff', formatNumber(value.spectralRolloff, 2) + ' Hz'],
      ['Flatness', formatNumber(value.spectralFlatness, 4)],
      ['Zero Crossing', formatNumber(value.zeroCrossingRate, 5)]
    ]
  },
  lufs: {
    title: 'Loudness (LUFS)',
    run: async (audio) =>
      AudioInspect.getLUFS(audio, {
        channelMode: audio.numberOfChannels >= 2 ? 'stereo' : 'mono',
        gated: true,
        calculateShortTerm: true,
        calculateMomentary: true,
        calculateLoudnessRange: true,
        calculateTruePeak: true
      }),
    metrics: (value) => [
      ['Integrated', formatNumber(value.integrated, 2) + ' LUFS'],
      ['LRA', value.loudnessRange == null ? 'n/a' : formatNumber(value.loudnessRange, 2) + ' LU'],
      ['Momentary Frames', String(value.momentary?.length ?? 0)],
      ['Short-term Frames', String(value.shortTerm?.length ?? 0)],
      ['True Peak', value.truePeak?.map((v) => formatNumber(v, 2) + ' dBTP').join(' | ') ?? 'n/a']
    ]
  },
  vad: {
    title: 'VAD',
    run: async (_audio, cfg) =>
      AudioInspect.getVAD(cfg.monoAudio, {
        method: 'adaptive',
        frameSizeMs: 30,
        hopSizeMs: 10,
        smoothing: true,
        minSpeechDurationMs: 100,
        minSilenceDurationMs: 300
      }),
    metrics: (value) => {
      const speechSegments = value.segments.filter((seg) => seg.type === 'speech');
      const speechDuration = speechSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      return [
        ['Segments', String(value.segments.length)],
        ['Speech Segments', String(speechSegments.length)],
        ['Speech Ratio', formatNumber(value.speechRatio * 100, 2) + '%'],
        ['Speech Duration', formatNumber(speechDuration, 3) + ' s'],
        ['Frames', String(value.features?.times?.length ?? 0)]
      ];
    }
  },
  stereo: {
    title: 'Stereo Image',
    run: async (audio) => {
      if (audio.numberOfChannels < 2) {
        return { skipped: true, reason: 'Input is mono; stereo metrics need at least 2 channels.' };
      }
      return AudioInspect.getStereoAnalysis(audio, {
        calculatePhase: true,
        calculateITD: true,
        calculateILD: true
      });
    },
    metrics: (value) => {
      if (value.skipped) {
        return [['Status', value.reason]];
      }
      return [
        ['Correlation', formatNumber(value.correlation, 4)],
        ['Width', formatNumber(value.width, 4)],
        ['Balance', formatNumber(value.balance, 4)],
        ['Mid/Side Ratio', formatNumber(value.midSideRatio, 2) + ' dB'],
        ['ITD / ILD', `${formatNumber(value.itd ?? 0, 3)} ms / ${formatNumber(value.ild ?? 0, 2)} dB`]
      ];
    }
  },
  mfcc: {
    title: 'MFCC',
    run: async (_audio, cfg) =>
      AudioInspect.getMFCC(cfg.monoAudio, {
        frameSizeMs: 25,
        hopSizeMs: 10,
        numMelFilters: 32,
        numMfccCoeffs: 13,
        windowFunction: 'hamming',
        preEmphasis: 0.97,
        lifterCoeff: 22,
        minFrequency: 20,
        maxFrequency: cfg.monoAudio.sampleRate / 2,
        channel: 0
      }),
    metrics: (value) => {
      const firstFrame = value.mfcc[0] ?? [];
      const head = firstFrame.slice(0, 4).map((v) => formatNumber(v, 3));
      return [
        ['Frames', String(value.frameInfo.numFrames)],
        ['Coefficients', String(value.frameInfo.numCoeffs)],
        ['Frame/Hop', `${value.frameInfo.frameSizeMs} ms / ${value.frameInfo.hopSizeMs} ms`],
        ['First Coeffs', head.length > 0 ? head.join(', ') : 'n/a']
      ];
    }
  }
};

function init() {
  elements.fileInput.addEventListener('change', onFileSelected);
  elements.controlForm.addEventListener('submit', onAnalyze);
  elements.clearBtn.addEventListener('click', clearAll);
  window.addEventListener('resize', redrawCanvases);
  drawEmptyWaveform();
  drawEmptySpectrum();
}

function onFileSelected(event) {
  const file = event.target.files?.[0] ?? null;
  state.file = file;

  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  if (!file) {
    state.audioData = null;
    state.lastResults = null;
    clearResultsOnly();
    setProgress(0);
    drawEmptyWaveform();
    drawEmptySpectrum();
    elements.audioPlayer.removeAttribute('src');
    updateMetaFromFile(null);
    elements.analyzeBtn.disabled = true;
    setStatus('Select a WAV file to begin.', 'info');
    return;
  }

  state.audioData = null;
  state.lastResults = null;
  clearResultsOnly();
  setProgress(0);
  drawEmptyWaveform();
  drawEmptySpectrum();

  state.objectUrl = URL.createObjectURL(file);
  elements.audioPlayer.src = state.objectUrl;

  updateMetaFromFile(file);
  elements.analyzeBtn.disabled = false;
  setStatus('File selected. Configure options and run analyses.', 'info');
}

async function onAnalyze(event) {
  event.preventDefault();

  if (!state.file) {
    setStatus('Select a WAV file before running analyses.', 'warn');
    return;
  }

  const selectedIds = getSelectedAnalysisIds();
  if (selectedIds.length === 0) {
    setStatus('Enable at least one analysis.', 'warn');
    return;
  }

  elements.analyzeBtn.disabled = true;
  clearResultsOnly();
  setProgress(0);

  try {
    setStatus('Decoding audio file...', 'info');
    const loadStart = performance.now();
    const audio = await AudioInspect.load(state.file, buildLoadOptions());
    const loadMs = performance.now() - loadStart;

    state.audioData = audio;
    updateMetaFromAudio(audio, loadMs);
    drawWaveform(audio.channelData[0] ?? new Float32Array(0));

    const monoAudio = audio.numberOfChannels > 1 ? AudioInspect.toMono(audio) : audio;

    const cfg = {
      fftSize: Number(elements.fftSize.value),
      peakThreshold: clamp(Number(elements.peakThreshold.value), 0, 1),
      monoAudio
    };

    const results = {
      file: {
        name: state.file.name,
        sizeBytes: state.file.size,
        options: buildLoadOptions()
      },
      audio: {
        duration: audio.duration,
        sampleRate: audio.sampleRate,
        channels: audio.numberOfChannels,
        samples: audio.length,
        decodeMs: loadMs,
        analysisChannelMode: audio.numberOfChannels > 1 ? 'mono-mix' : 'channel-0'
      },
      analyses: {}
    };

    let okCount = 0;
    let errorCount = 0;

    for (let index = 0; index < selectedIds.length; index++) {
      const id = selectedIds[index];
      const def = ANALYSIS_DEFS[id];
      const stepText = `Running ${def.title} (${index + 1}/${selectedIds.length})...`;
      setStatus(stepText, 'info');

      const start = performance.now();
      try {
        const value = await def.run(audio, cfg);
        const elapsedMs = performance.now() - start;
        results.analyses[id] = {
          ok: true,
          elapsedMs,
          value
        };
        renderResultCard(id, def.title, def.metrics(value), elapsedMs, true, index);

        if (id === 'spectrum') {
          drawSpectrum(value);
        }

        okCount++;
      } catch (error) {
        const elapsedMs = performance.now() - start;
        const message = error instanceof Error ? error.message : String(error);
        results.analyses[id] = {
          ok: false,
          elapsedMs,
          error: message
        };
        renderResultCard(id, def.title, [['Error', message]], elapsedMs, false, index);
        errorCount++;
      }

      setProgress(((index + 1) / selectedIds.length) * 100);
    }

    state.lastResults = results;
    elements.rawJson.textContent = JSON.stringify(results, null, 2);

    const summary = `${okCount} succeeded, ${errorCount} failed`;
    elements.runSummary.textContent = summary;
    setStatus(errorCount > 0 ? `Completed with issues: ${summary}` : `Completed: ${summary}`, errorCount > 0 ? 'warn' : 'info');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Analysis failed: ${message}`, 'error');
  } finally {
    elements.analyzeBtn.disabled = !state.file;
  }
}

function buildLoadOptions() {
  const options = {
    normalize: elements.normalizeInput.checked
  };

  const channels = elements.channelMode.value;
  if (channels !== 'original') {
    options.channels = channels;
  }

  const rate = elements.targetSampleRate.value;
  if (rate !== 'native') {
    options.sampleRate = Number(rate);
  }

  return options;
}

function getSelectedAnalysisIds() {
  return Array.from(document.querySelectorAll('[data-analysis]'))
    .filter((input) => input.checked)
    .map((input) => input.dataset.analysis)
    .filter((id) => id in ANALYSIS_DEFS);
}

function updateMetaFromFile(file) {
  if (!file) {
    elements.metaFile.textContent = '-';
    elements.metaDuration.textContent = '-';
    elements.metaRate.textContent = '-';
    elements.metaChannels.textContent = '-';
    return;
  }

  elements.metaFile.textContent = `${file.name} (${formatBytes(file.size)})`;
  elements.metaDuration.textContent = 'Decoding...';
  elements.metaRate.textContent = '-';
  elements.metaChannels.textContent = '-';
}

function updateMetaFromAudio(audio, decodeMs) {
  elements.metaDuration.textContent = `${formatNumber(audio.duration, 3)} s`;
  elements.metaRate.textContent = `${audio.sampleRate} Hz`;
  elements.metaChannels.textContent = `${audio.numberOfChannels}`;
  elements.metaFile.textContent = `${state.file?.name ?? '-'} (${formatBytes(state.file?.size ?? 0)})`;
  elements.runSummary.textContent = `Decoded in ${formatNumber(decodeMs, 1)} ms`;
}

function renderResultCard(id, title, metrics, elapsedMs, ok, index) {
  const article = document.createElement('article');
  article.className = `result-card ${ok ? 'ok' : 'error'}`;
  article.style.setProperty('--delay', `${Math.min(index * 45, 360)}ms`);

  const metricHtml = metrics
    .map(([label, value]) => {
      return `<div class="metric"><span>${escapeHtml(label)}</span><span>${escapeHtml(String(value))}</span></div>`;
    })
    .join('');

  article.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <div class="result-meta">${escapeHtml(id)} | ${formatNumber(elapsedMs, 1)} ms</div>
    <div class="result-body">${metricHtml}</div>
  `;

  elements.resultGrid.appendChild(article);
}

function clearResultsOnly() {
  elements.resultGrid.innerHTML = '';
  elements.rawJson.textContent = '{}';
  elements.runSummary.textContent = 'No analysis yet.';
}

function clearAll() {
  clearResultsOnly();
  setStatus(
    state.file ? 'Results cleared. Ready to run analyses for the selected file.' : 'Select a WAV file to begin.',
    'info'
  );
  setProgress(0);
  state.lastResults = null;

  if (state.audioData) {
    drawWaveform(state.audioData.channelData[0] ?? new Float32Array(0));
  } else {
    drawEmptyWaveform();
  }

  drawEmptySpectrum();
}

function setStatus(message, level) {
  elements.statusLine.textContent = message;
  elements.statusLine.className = `status-line ${level === 'info' ? '' : level}`.trim();
}

function setProgress(value) {
  elements.progressBar.style.width = `${clamp(value, 0, 100)}%`;
}

function drawWaveform(samples) {
  const canvas = elements.waveformCanvas;
  const ctx = canvas.getContext('2d');
  fitCanvasToDisplay(canvas);

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0f1f2b';
  ctx.fillRect(0, 0, width, height);

  if (!samples || samples.length === 0) {
    drawCenterLine(ctx, width, height, '#335b73');
    return;
  }

  drawCenterLine(ctx, width, height, '#284f63');

  const bucketSize = Math.max(1, Math.floor(samples.length / width));
  ctx.strokeStyle = '#53b7d8';
  ctx.lineWidth = 1;

  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const start = x * bucketSize;
    const end = Math.min(start + bucketSize, samples.length);
    let min = 1;
    let max = -1;

    for (let i = start; i < end; i++) {
      const v = samples[i] ?? 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const y1 = ((1 - max) * 0.5) * height;
    const y2 = ((1 - min) * 0.5) * height;
    ctx.moveTo(x + 0.5, y1);
    ctx.lineTo(x + 0.5, y2);
  }
  ctx.stroke();
}

function drawSpectrum(spectrumResult) {
  const canvas = elements.spectrumCanvas;
  const ctx = canvas.getContext('2d');
  fitCanvasToDisplay(canvas);

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0f1f2b';
  ctx.fillRect(0, 0, width, height);

  const decibels = spectrumResult.decibels ?? convertMagnitudesToDb(spectrumResult.magnitudes);
  if (!decibels || decibels.length === 0) {
    drawCenterLine(ctx, width, height, '#335b73');
    return;
  }

  const minDb = -120;
  const maxDb = 0;
  const step = Math.max(1, Math.floor(decibels.length / width));

  ctx.strokeStyle = '#f0a14f';
  ctx.lineWidth = 2;
  ctx.beginPath();

  let penDown = false;
  for (let x = 0; x < width; x++) {
    const idx = x * step;
    const db = decibels[Math.min(idx, decibels.length - 1)] ?? minDb;
    const normalized = clamp((db - minDb) / (maxDb - minDb), 0, 1);
    const y = height - normalized * height;

    if (!penDown) {
      ctx.moveTo(x, y);
      penDown = true;
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

function drawEmptyWaveform() {
  drawWaveform(new Float32Array(0));
}

function drawEmptySpectrum() {
  const fake = {
    magnitudes: new Float32Array(0),
    decibels: new Float32Array(0)
  };
  drawSpectrum(fake);
}

function redrawCanvases() {
  if (state.audioData) {
    drawWaveform(state.audioData.channelData[0] ?? new Float32Array(0));

    const spectrumResult = state.lastResults?.analyses?.spectrum;
    if (spectrumResult?.ok && spectrumResult.value) {
      drawSpectrum(spectrumResult.value);
    } else {
      drawEmptySpectrum();
    }
  } else {
    drawEmptyWaveform();
    drawEmptySpectrum();
  }
}

function drawCenterLine(ctx, width, height, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function fitCanvasToDisplay(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const displayWidth = Math.floor(canvas.clientWidth * ratio);
  const displayHeight = Math.floor(canvas.clientHeight * ratio);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

function findDominantFrequency(frequencies, magnitudes) {
  let peakIndex = 0;
  let peakMagnitude = -Infinity;

  for (let i = 0; i < magnitudes.length; i++) {
    const mag = magnitudes[i] ?? 0;
    if (mag > peakMagnitude) {
      peakMagnitude = mag;
      peakIndex = i;
    }
  }

  return {
    frequency: frequencies[peakIndex] ?? 0,
    magnitude: peakMagnitude
  };
}

function convertMagnitudesToDb(magnitudes) {
  const out = new Float32Array(magnitudes.length);
  for (let i = 0; i < magnitudes.length; i++) {
    const mag = magnitudes[i] ?? 0;
    out[i] = mag > 0 ? 20 * Math.log10(mag) : -120;
  }
  return out;
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }
  return Number(value).toFixed(digits);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let size = bytes;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx++;
  }
  return `${size.toFixed(size < 10 && idx > 0 ? 2 : 1)} ${units[idx]}`;
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

init();

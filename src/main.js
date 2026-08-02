// Wires together audio loading, analysis, decision engine, processing
// chain, and UI. Kept intentionally thin — real logic lives in the
// src/audio, src/analysis, src/decision, src/processing, src/ui modules.
//
// Track-list rendering (including Phase 6 override sliders) still lives
// here rather than its own src/ui/index.js module. It's grown
// substantially across phases 5 and 6 — this file is now a legitimate
// refactor candidate. Deferred again because nothing is currently
// broken by the size, and splitting it "just because it's long" without
// a concrete next feature driving the split tends to produce arbitrary
// boundaries. If Phase 7 adds another chunk of UI logic here, do the
// split first before adding more.

import { loadFiles } from './audio/loader.js';
import { analyzeTrack } from './analysis/index.js';
import { runDecisionEngine } from './decision/index.js';
import { setGainOverride, clearGainOverride, setPanOverride, clearPanOverride } from './decision/overrides.js';
import { createTransport } from './ui/transport.js';
import { readLevel } from './ui/meters.js';
import { dbToLinear } from './processing/trackChain.js';
import { renderMix } from './processing/render.js';
import { audioBufferToWav } from './processing/wavEncoder.js';

/** @type {import('./audio/track.js').Track[]} */
const tracks = [];

const transport = createTransport();
transport.onEnded(() => {
  updateTransportControls();
});

let meterLoopId = null;
let isExporting = false;

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const tracksEl = document.getElementById('tracks');
const errorsEl = document.getElementById('errors');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const timeEl = document.getElementById('transport-time');
const exportBtn = document.getElementById('export-btn');

exportBtn.addEventListener('click', handleExport);

playBtn.addEventListener('click', () => {
  if (transport.play(tracks)) {
    updateTransportControls();
    startMeterLoop();
  }
});

pauseBtn.addEventListener('click', () => {
  transport.pause();
  updateTransportControls();
});

stopBtn.addEventListener('click', () => {
  transport.stop();
  updateTransportControls();
});

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInput.value = ''; // allow re-selecting the same file later
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

async function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  const { tracks: newTracks, errors } = await loadFiles(fileList);
  tracks.push(...newTracks);

  renderErrors(errors);
  renderTracks();

  for (const track of newTracks) {
    const analysis = analyzeTrack(track);
    console.log(`levelhead: analyzed "${track.name}"`, analysis);
  }

  runDecisions();
  renderTracks();
  updateTransportControls();
}

function setLeadTrack(trackId) {
  transport.stop(); // targets are about to change under any currently-playing chain
  updateTransportControls();
  for (const track of tracks) {
    track.isLead = track.id === trackId;
  }
  runDecisions();
  renderTracks();
}

function runDecisions() {
  const result = runDecisionEngine(tracks);
  if (result.referenceTrackId !== null) {
    console.log(`levelhead: decision engine ran — reference: ${result.referenceReason}`, result);
  }
}

function updateTransportControls() {
  const status = transport.getStatus();
  const hasPlayable = tracks.some((t) => t.targets);

  playBtn.disabled = status === 'playing' || !hasPlayable;
  playBtn.textContent = status === 'paused' ? '▶ Resume' : '▶ Play mix';
  pauseBtn.disabled = status !== 'playing';
  stopBtn.disabled = status === 'stopped';
  exportBtn.disabled = isExporting || !hasPlayable;

  if (status === 'stopped') {
    stopMeterLoop();
    timeEl.textContent = '';
  }
}

async function handleExport() {
  if (isExporting || !tracks.some((t) => t.targets)) return;

  isExporting = true;
  updateTransportControls();
  const originalLabel = exportBtn.textContent;
  exportBtn.textContent = 'Rendering…';

  try {
    // Offline rendering is independent of live playback — export while
    // something is playing is fine, they don't share any mutable state
    // (renderMix builds its own OfflineAudioContext and its own chains).
    const renderedBuffer = await renderMix(tracks);
    const wavBlob = audioBufferToWav(renderedBuffer);
    downloadBlob(wavBlob, 'levelhead-mix.wav');
  } catch (err) {
    console.error('levelhead: export failed', err);
    errorsEl.textContent = `Export failed: ${err.message}`;
  } finally {
    isExporting = false;
    exportBtn.textContent = originalLabel;
    updateTransportControls();
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function startMeterLoop() {
  if (meterLoopId !== null) return;
  const tick = () => {
    if (transport.getStatus() === 'stopped') {
      meterLoopId = null;
      return;
    }
    updateElapsedTime();
    updateMeters();
    meterLoopId = requestAnimationFrame(tick);
  };
  meterLoopId = requestAnimationFrame(tick);
}

function stopMeterLoop() {
  if (meterLoopId !== null) {
    cancelAnimationFrame(meterLoopId);
    meterLoopId = null;
  }
}

function updateElapsedTime() {
  timeEl.textContent = formatDuration(transport.getElapsedSeconds());
}

function getLiveChain(trackId) {
  return transport.getChains().find((c) => c.trackId === trackId) || null;
}

function updateMeters() {
  // Chains are ordered to match the playable-tracks list transport built
  // them from, not necessarily `tracks` — match by matching the DOM
  // element's data-track-id instead of assuming index alignment.
  const chains = transport.getChains();
  for (const chain of chains) {
    const bar = document.querySelector(`.meter-fill[data-chain-track-id="${chain.trackId}"]`);
    if (!bar) continue;
    const level = readLevel(chain.analyserNode);
    // RMS of a full-scale sine is ~0.7, so scale up a bit for a meter
    // that visually uses more of its range on normal program material.
    const pct = Math.min(100, level * 140);
    bar.style.width = `${pct}%`;
  }
}

function renderTracks() {
  tracksEl.innerHTML = '';
  for (const track of tracks) {
    const el = document.createElement('div');
    el.className = 'track' + (track.isLead ? ' is-lead' : '');

    const meta = `${formatDuration(track.duration)} · ${track.numberOfChannels}ch · ${track.sampleRate}Hz`;
    const analysisMeta = track.analysis
      ? ` · ${formatDb(track.analysis.loudness.averageDb)} avg · ${track.analysis.transients.count} onsets`
      : ' · analyzing…';
    const targetsMeta = track.targets
      ? ` · gain ${formatSigned(track.targets.gainDb)}dB · pan ${formatPan(track.targets.pan)}` +
        (track.targets.eqMoves.length > 0 ? ` · ${track.targets.eqMoves.length} EQ cut(s)` : '')
      : '';

    const header = document.createElement('div');
    header.className = 'track-header';

    const info = document.createElement('div');
    info.innerHTML = `
      <span class="track-name">${escapeHtml(track.name)}</span>
      <span class="track-meta">${meta}${analysisMeta}${targetsMeta}</span>
    `;

    const leadButton = document.createElement('button');
    leadButton.className = 'lead-toggle';
    leadButton.textContent = track.isLead ? '★ Lead' : 'Mark lead';
    leadButton.addEventListener('click', () => setLeadTrack(track.id));

    header.appendChild(info);
    header.appendChild(leadButton);

    const meter = document.createElement('div');
    meter.className = 'meter';
    meter.innerHTML = `<div class="meter-fill" data-chain-track-id="${track.id}"></div>`;

    el.appendChild(header);
    el.appendChild(meter);

    if (track.targets) {
      el.appendChild(buildOverrideControls(track));
    }

    if (track.targets && track.targets.reasons.length > 0) {
      const details = document.createElement('details');
      details.className = 'reasons';
      const summary = document.createElement('summary');
      summary.textContent = 'Why these settings?';
      const list = document.createElement('ul');
      for (const reason of track.targets.reasons) {
        const li = document.createElement('li');
        li.textContent = reason;
        list.appendChild(li);
      }
      details.appendChild(summary);
      details.appendChild(list);
      el.appendChild(details);
    }

    tracksEl.appendChild(el);
  }
}

// Builds the gain/pan override sliders for one track row. Deliberately
// split into two DOM event patterns:
//   - 'input' (fires continuously while dragging): update the live audio
//     param directly and refresh only the text label — no re-render,
//     since replacing the slider's own DOM node mid-drag would break
//     the drag interaction in most browsers.
//   - 'change' (fires once, on release): commit the override via
//     setGainOverride/setPanOverride, re-run the decision engine (safe
//     now that the drag has ended), and do a full renderTracks().
function buildOverrideControls(track) {
  const wrap = document.createElement('div');
  wrap.className = 'overrides';

  // --- Gain ---
  const gainRow = document.createElement('label');
  gainRow.className = 'override-row';
  const gainLabelText = document.createElement('span');
  gainLabelText.textContent = 'Gain';
  const gainValue = document.createElement('span');
  gainValue.className = 'override-value';
  const gainSlider = document.createElement('input');
  gainSlider.type = 'range';
  gainSlider.min = '-12';
  gainSlider.max = '12';
  gainSlider.step = '0.5';
  gainSlider.value = String(track.targets.gainDb);
  const gainReset = document.createElement('button');
  gainReset.type = 'button';
  gainReset.className = 'override-reset';
  gainReset.title = 'Reset to automatic';
  gainReset.textContent = '↺';
  gainReset.disabled = track.overrides.gainDb === null;

  const updateGainLabel = (value, manual) => {
    gainValue.textContent = `${formatSigned(value)}dB${manual ? ' (manual)' : ''}`;
  };
  updateGainLabel(track.targets.gainDb, track.overrides.gainDb !== null);

  gainSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    updateGainLabel(value, true);
    const liveChain = getLiveChain(track.id);
    if (liveChain) liveChain.gainNode.gain.value = dbToLinear(value);
  });
  gainSlider.addEventListener('change', (e) => {
    setGainOverride(track, parseFloat(e.target.value));
    runDecisions();
    renderTracks();
  });
  gainReset.addEventListener('click', () => {
    clearGainOverride(track);
    runDecisions();
    const liveChain = getLiveChain(track.id);
    if (liveChain) liveChain.gainNode.gain.value = dbToLinear(track.targets.gainDb);
    renderTracks();
  });

  gainRow.appendChild(gainLabelText);
  gainRow.appendChild(gainSlider);
  gainRow.appendChild(gainValue);
  gainRow.appendChild(gainReset);

  // --- Pan ---
  const panRow = document.createElement('label');
  panRow.className = 'override-row';
  const panLabelText = document.createElement('span');
  panLabelText.textContent = 'Pan';
  const panValue = document.createElement('span');
  panValue.className = 'override-value';
  const panSlider = document.createElement('input');
  panSlider.type = 'range';
  panSlider.min = '-1';
  panSlider.max = '1';
  panSlider.step = '0.05';
  panSlider.value = String(track.targets.pan);
  const panReset = document.createElement('button');
  panReset.type = 'button';
  panReset.className = 'override-reset';
  panReset.title = 'Reset to automatic';
  panReset.textContent = '↺';
  panReset.disabled = track.overrides.pan === null;

  const updatePanLabel = (value, manual) => {
    panValue.textContent = `${formatPan(value)}${manual ? ' (manual)' : ''}`;
  };
  updatePanLabel(track.targets.pan, track.overrides.pan !== null);

  panSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    updatePanLabel(value, true);
    const liveChain = getLiveChain(track.id);
    if (liveChain) liveChain.pannerNode.pan.value = value;
  });
  panSlider.addEventListener('change', (e) => {
    setPanOverride(track, parseFloat(e.target.value));
    runDecisions();
    renderTracks();
  });
  panReset.addEventListener('click', () => {
    clearPanOverride(track);
    runDecisions();
    const liveChain = getLiveChain(track.id);
    if (liveChain) liveChain.pannerNode.pan.value = track.targets.pan;
    renderTracks();
  });

  panRow.appendChild(panLabelText);
  panRow.appendChild(panSlider);
  panRow.appendChild(panValue);
  panRow.appendChild(panReset);

  wrap.appendChild(gainRow);
  wrap.appendChild(panRow);
  return wrap;
}

function formatSigned(value) {
  return (value >= 0 ? '+' : '') + value.toFixed(1);
}

function formatPan(pan) {
  if (Math.abs(pan) < 0.01) return 'C';
  const side = pan < 0 ? 'L' : 'R';
  return `${Math.round(Math.abs(pan) * 100)}${side}`;
}

function formatDb(db) {
  if (!isFinite(db)) return '−∞ dB';
  return `${db.toFixed(1)} dB`;
}

function renderErrors(errors) {
  if (errors.length === 0) {
    errorsEl.textContent = '';
    return;
  }
  errorsEl.textContent = errors
    .map((e) => `${e.file.name}: ${e.message}`)
    .join(' — ');
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

updateTransportControls();
console.log('levelhead: Phase 7 (WAV export) wired up');

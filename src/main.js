// Wires together audio loading, analysis, decision engine, processing
// chain, and UI. Kept thin — real logic lives in the src/audio,
// src/analysis, src/decision, src/processing, src/ui modules.
//
// Track-list rendering (rows, meters, override sliders, reasoning
// panel) lives in src/ui/trackList.js as of session 8 — split out once
// the genre preset selector became a second chunk of UI logic landing
// here, per the deferral note this file used to carry. This file's job
// now is just: own the app's state (tracks array, transport, current
// preset), and wire DOM events to state changes.

import { loadFiles } from './audio/loader.js';
import { analyzeTrack } from './analysis/index.js';
import { runDecisionEngine } from './decision/index.js';
import { setGainOverride, clearGainOverride, setPanOverride, clearPanOverride } from './decision/overrides.js';
import { PRESETS, DEFAULT_PRESET_ID } from './decision/presets.js';
import { createTransport } from './ui/transport.js';
import { readLevel } from './ui/meters.js';
import { renderTrackList } from './ui/trackList.js';
import { dbToLinear } from './processing/trackChain.js';
import { renderMix } from './processing/render.js';
import { audioBufferToWav } from './processing/wavEncoder.js';

/** @type {import('./audio/track.js').Track[]} */
const tracks = [];

const transport = createTransport();
transport.onEnded(() => updateTransportControls());

let meterLoopId = null;
let isExporting = false;
let currentPresetId = DEFAULT_PRESET_ID;

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const tracksEl = document.getElementById('tracks');
const errorsEl = document.getElementById('errors');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const timeEl = document.getElementById('transport-time');
const exportBtn = document.getElementById('export-btn');
const presetSelect = document.getElementById('preset-select');
const presetDescriptionEl = document.getElementById('preset-description');

populatePresetOptions();
updatePresetDescription();

presetSelect.addEventListener('change', (e) => {
  currentPresetId = e.target.value;
  updatePresetDescription();
  transport.stop(); // targets are about to change under any currently-playing chain
  updateTransportControls();
  runDecisions();
  renderTracks();
});

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
  const result = runDecisionEngine(tracks, currentPresetId);
  if (result.referenceTrackId !== null) {
    console.log(
      `levelhead: decision engine ran — preset: ${result.presetId}, reference: ${result.referenceReason}`,
      result
    );
  }
}

function populatePresetOptions() {
  for (const [id, preset] of Object.entries(PRESETS)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = preset.label;
    presetSelect.appendChild(option);
  }
  presetSelect.value = currentPresetId;
}

function updatePresetDescription() {
  presetDescriptionEl.textContent = PRESETS[currentPresetId]?.description || '';
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
  renderTrackList(tracksEl, tracks, {
    getLiveChain,
    dbToLinear,
    onSetLead: setLeadTrack,
    onGainCommit: (track, value) => {
      setGainOverride(track, value);
      runDecisions();
      renderTracks();
    },
    onGainReset: (track) => {
      clearGainOverride(track);
      runDecisions();
      const liveChain = getLiveChain(track.id);
      if (liveChain) liveChain.gainNode.gain.value = dbToLinear(track.targets.gainDb);
      renderTracks();
    },
    onPanCommit: (track, value) => {
      setPanOverride(track, value);
      runDecisions();
      renderTracks();
    },
    onPanReset: (track) => {
      clearPanOverride(track);
      runDecisions();
      const liveChain = getLiveChain(track.id);
      if (liveChain) liveChain.pannerNode.pan.value = track.targets.pan;
      renderTracks();
    },
  });
}

function renderErrors(errors) {
  if (errors.length === 0) {
    errorsEl.textContent = '';
    return;
  }
  errorsEl.textContent = errors.map((e) => `${e.file.name}: ${e.message}`).join(' — ');
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

updateTransportControls();
console.log('levelhead: Phase 7c (genre presets) wired up');

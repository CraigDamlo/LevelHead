// Wires together audio loading, analysis, decision engine, processing
// chain, and UI. Kept intentionally thin — real logic lives in the
// src/audio, src/analysis, src/decision, src/processing, src/ui modules.
//
// Phase 1 (audio loading) is wired up here directly since there's not
// enough UI yet to warrant its own src/ui module. Once Phase 5 UI work
// starts, the track-list rendering below should move to src/ui/.

import { loadFiles } from './audio/loader.js';
import { analyzeTrack } from './analysis/index.js';
import { runDecisionEngine } from './decision/index.js';

/** @type {import('./audio/track.js').Track[]} */
const tracks = [];

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const tracksEl = document.getElementById('tracks');
const errorsEl = document.getElementById('errors');

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
}

function setLeadTrack(trackId) {
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

    const leadButton = document.createElement('button');
    leadButton.className = 'lead-toggle';
    leadButton.textContent = track.isLead ? '★ Lead' : 'Mark lead';
    leadButton.title = track.targets ? track.targets.reasons.join('\n') : '';
    leadButton.addEventListener('click', () => setLeadTrack(track.id));

    const info = document.createElement('div');
    info.innerHTML = `
      <span class="track-name">${escapeHtml(track.name)}</span>
      <span class="track-meta">${meta}${analysisMeta}${targetsMeta}</span>
    `;

    el.appendChild(info);
    el.appendChild(leadButton);
    tracksEl.appendChild(el);
  }
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

console.log('levelhead: Phase 1 (audio loading) wired up');

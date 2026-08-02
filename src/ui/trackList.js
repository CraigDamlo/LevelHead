// Renders the track list: per-track header/meta, the lead-marking
// button, the level meter bar, gain/pan override sliders, and the
// "why these settings?" reasoning panel. Split out of main.js in
// session 8 (Phase 7c) once a second chunk of UI logic (the genre
// preset selector) made main.js's size an actual liability rather than
// just a long file — see the note in main.js for why this wasn't done
// preemptively.
//
// Deliberately callback-based rather than importing decision/transport
// modules directly: this module only touches the DOM and reads plain
// data off Track objects. All state mutation (marking a lead, setting
// an override, re-running the decision engine) stays owned by
// main.js, passed in as callbacks. Keeps this module testable and
// reusable without dragging in the whole app's wiring.

/**
 * @param {HTMLElement} tracksEl - container to render rows into
 * @param {import('../audio/track.js').Track[]} tracks
 * @param {{
 *   getLiveChain: (trackId: number) => object|null,
 *   dbToLinear: (db: number) => number,
 *   onSetLead: (trackId: number) => void,
 *   onGainCommit: (track: object, value: number) => void,
 *   onGainReset: (track: object) => void,
 *   onPanCommit: (track: object, value: number) => void,
 *   onPanReset: (track: object) => void,
 * }} handlers
 */
export function renderTrackList(tracksEl, tracks, handlers) {
  tracksEl.innerHTML = '';
  for (const track of tracks) {
    tracksEl.appendChild(buildTrackRow(track, handlers));
  }
}

function buildTrackRow(track, handlers) {
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
  leadButton.addEventListener('click', () => handlers.onSetLead(track.id));

  header.appendChild(info);
  header.appendChild(leadButton);

  const meter = document.createElement('div');
  meter.className = 'meter';
  meter.innerHTML = `<div class="meter-fill" data-chain-track-id="${track.id}"></div>`;

  el.appendChild(header);
  el.appendChild(meter);

  if (track.targets) {
    el.appendChild(buildOverrideControls(track, handlers));
  }

  if (track.targets && track.targets.reasons.length > 0) {
    el.appendChild(buildReasonsPanel(track.targets.reasons));
  }

  return el;
}

function buildReasonsPanel(reasons) {
  const details = document.createElement('details');
  details.className = 'reasons';
  const summary = document.createElement('summary');
  summary.textContent = 'Why these settings?';
  const list = document.createElement('ul');
  for (const reason of reasons) {
    const li = document.createElement('li');
    li.textContent = reason;
    list.appendChild(li);
  }
  details.appendChild(summary);
  details.appendChild(list);
  return details;
}

// Deliberately split into two DOM event patterns per slider:
//   - 'input' (fires continuously while dragging): update the live
//     audio param directly and refresh only the text label — no
//     re-render, since replacing the slider's own DOM node mid-drag
//     breaks the drag interaction in most browsers.
//   - 'change' (fires once, on release): commit the override via the
//     provided handler, which is expected to re-run the decision
//     engine and trigger a full re-render — safe now that the drag has
//     ended.
function buildOverrideControls(track, handlers) {
  const wrap = document.createElement('div');
  wrap.className = 'overrides';

  wrap.appendChild(
    buildSliderRow({
      label: 'Gain',
      min: -12,
      max: 12,
      step: 0.5,
      value: track.targets.gainDb,
      isOverridden: track.overrides.gainDb !== null,
      formatValue: (v) => `${formatSigned(v)}dB`,
      onLiveInput: (value) => {
        const liveChain = handlers.getLiveChain(track.id);
        if (liveChain) liveChain.gainNode.gain.value = handlers.dbToLinear(value);
      },
      onCommit: (value) => handlers.onGainCommit(track, value),
      onReset: () => handlers.onGainReset(track),
    })
  );

  wrap.appendChild(
    buildSliderRow({
      label: 'Pan',
      min: -1,
      max: 1,
      step: 0.05,
      value: track.targets.pan,
      isOverridden: track.overrides.pan !== null,
      formatValue: (v) => formatPan(v),
      onLiveInput: (value) => {
        const liveChain = handlers.getLiveChain(track.id);
        if (liveChain) liveChain.pannerNode.pan.value = value;
      },
      onCommit: (value) => handlers.onPanCommit(track, value),
      onReset: () => handlers.onPanReset(track),
    })
  );

  return wrap;
}

function buildSliderRow({ label, min, max, step, value, isOverridden, formatValue, onLiveInput, onCommit, onReset }) {
  const row = document.createElement('label');
  row.className = 'override-row';

  const labelText = document.createElement('span');
  labelText.textContent = label;

  const valueText = document.createElement('span');
  valueText.className = 'override-value';
  const updateLabel = (v, manual) => {
    valueText.textContent = `${formatValue(v)}${manual ? ' (manual)' : ''}`;
  };
  updateLabel(value, isOverridden);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'override-reset';
  reset.title = 'Reset to automatic';
  reset.textContent = '↺';
  reset.disabled = !isOverridden;

  slider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    updateLabel(v, true);
    onLiveInput(v);
  });
  slider.addEventListener('change', (e) => {
    onCommit(parseFloat(e.target.value));
  });
  reset.addEventListener('click', onReset);

  row.appendChild(labelText);
  row.appendChild(slider);
  row.appendChild(valueText);
  row.appendChild(reset);
  return row;
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

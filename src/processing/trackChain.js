// Builds the Web Audio node graph for a single track and applies its
// decision-engine targets (track.targets, from Phase 3) to real audio
// parameters:
//
//   source -> gain -> [peaking EQ filter per masking cut] -> panner -> bus
//
// If track.targets isn't set yet (Phase 3 hasn't run), falls back to
// neutral values (0dB gain, no EQ, centered pan) so a track can still be
// auditioned on its own.

// Approximate center frequency for each spectral band label — must stay
// in sync with the bands defined in src/analysis/spectral.js. Used to
// place peaking EQ filters for masking-conflict cuts.
const BAND_CENTER_HZ = {
  sub: 40,
  bass: 150,
  'low-mid': 375,
  mid: 1250,
  'high-mid': 3000,
  presence: 5000,
  air: 10000,
};

const EQ_Q = 1.0; // moderate-width peaking filter, not surgical

/**
 * @param {AudioContext} context
 * @param {import('../audio/track.js').Track} track
 * @param {AudioNode} destination - typically the shared bus (see bus.js)
 * @returns {{
 *   sourceNode: AudioBufferSourceNode,
 *   gainNode: GainNode,
 *   eqNodes: BiquadFilterNode[],
 *   pannerNode: StereoPannerNode,
 *   start: (when?: number) => void,
 *   stop: () => void
 * }}
 */
export function buildTrackChain(context, track, destination) {
  const targets = track.targets || { gainDb: 0, pan: 0, eqMoves: [] };

  const sourceNode = context.createBufferSource();
  sourceNode.buffer = track.audioBuffer;

  const gainNode = context.createGain();
  gainNode.gain.value = dbToLinear(targets.gainDb);

  const eqNodes = targets.eqMoves.map(({ band, cutDb }) => {
    const filter = context.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = BAND_CENTER_HZ[band] || 1000;
    filter.Q.value = EQ_Q;
    filter.gain.value = cutDb;
    return filter;
  });

  const pannerNode = context.createStereoPanner();
  pannerNode.pan.value = targets.pan;

  // Wire: source -> gain -> eq[0] -> eq[1] -> ... -> panner -> destination
  let node = sourceNode;
  node.connect(gainNode);
  node = gainNode;
  for (const eqNode of eqNodes) {
    node.connect(eqNode);
    node = eqNode;
  }
  node.connect(pannerNode);
  pannerNode.connect(destination);

  return {
    sourceNode,
    gainNode,
    eqNodes,
    pannerNode,
    start(when = 0) {
      sourceNode.start(when);
    },
    stop() {
      try {
        sourceNode.stop();
      } catch {
        // already stopped/never started — fine to ignore
      }
    },
  };
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

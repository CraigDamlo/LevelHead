// Tracks which of a track's mix parameters have been manually
// overridden by the user, and applies those overrides on top of the
// decision engine's automatic targets — so re-running the decision
// engine (e.g. after changing the lead track, or loading another track)
// doesn't silently discard a manual adjustment.
//
// Scope decision (session 6): overrides are per-parameter — gain and
// pan are independently lockable, not an all-or-nothing "manual mode"
// per track. This is more flexible and matches the "every automatic
// decision is an editable target" principle from README.md.
//
// EQ-move overrides are deliberately deferred: automatic EQ cuts are
// already conditional (they only appear when detectMasking() finds a
// real conflict — see src/decision/masking.js), and building override
// UI for an open-ended, variable-length list of per-band cuts is a
// bigger surface than a gain/pan slider. Revisit if gain/pan overrides
// turn out not to be enough control in practice.

/**
 * @param {import('../audio/track.js').Track} track
 * @param {number} gainDb
 */
export function setGainOverride(track, gainDb) {
  track.overrides.gainDb = gainDb;
}

/** @param {import('../audio/track.js').Track} track */
export function clearGainOverride(track) {
  track.overrides.gainDb = null;
}

/**
 * @param {import('../audio/track.js').Track} track
 * @param {number} pan - range -1 (full left) to 1 (full right)
 */
export function setPanOverride(track, pan) {
  track.overrides.pan = pan;
}

/** @param {import('../audio/track.js').Track} track */
export function clearPanOverride(track) {
  track.overrides.pan = null;
}

/**
 * Applies a track's overrides on top of its freshly-computed automatic
 * targets, mutating gainDb/pan/reasons in place where an override is
 * set. Called by the decision engine as its final step, after masking/
 * levels/panning have all run — see src/decision/index.js.
 *
 * @param {import('../audio/track.js').Track} track
 * @param {{gainDb: number, pan: number, eqMoves: object[], reasons: string[]}} targets
 * @returns {typeof targets}
 */
export function applyOverrides(track, targets) {
  const { overrides } = track;
  if (!overrides) return targets;

  if (overrides.gainDb !== null) {
    targets.reasons.push(
      `gain manually set to ${formatSigned(overrides.gainDb)}dB (automatic value was ${formatSigned(targets.gainDb)}dB)`
    );
    targets.gainDb = overrides.gainDb;
  }

  if (overrides.pan !== null) {
    targets.reasons.push(
      `pan manually set to ${overrides.pan.toFixed(2)} (automatic value was ${targets.pan.toFixed(2)})`
    );
    targets.pan = overrides.pan;
  }

  return targets;
}

function formatSigned(value) {
  return (value >= 0 ? '+' : '') + value.toFixed(1);
}

// Orchestrates the Phase 3 decision engine: picks the reference track,
// runs masking/level/panning rules against it, and stores the combined
// result on each track.targets. Every automatic decision carries a
// reason string (see AI_BUILD_GUIDE.md conventions) so the UI — and
// anyone debugging — can see why a value was chosen, not just what it is.
//
// Only tracks with .analysis already set (Phase 2 must have run) are
// considered. Requires at least one analyzed track; with fewer than two
// tracks, masking/panning rules degenerate harmlessly (nothing to
// compete with, nothing to spread).
//
// Phase 7c: accepts a genre preset id (see src/decision/presets.js) and
// threads its parameters through to each rule function. Defaults to
// the 'default' preset if omitted, so existing callers don't need to
// change.

import { determineReferenceTrack } from './reference.js';
import { detectMasking } from './masking.js';
import { balanceLevels } from './levels.js';
import { assignPanning } from './panning.js';
import { applyOverrides } from './overrides.js';
import { getPreset, DEFAULT_PRESET_ID } from './presets.js';

/**
 * @param {import('../audio/track.js').Track[]} tracks
 * @param {string} [presetId]
 * @returns {{referenceTrackId: number|null, referenceReason: string|null, presetId: string, targetsByTrack: Map}}
 */
export function runDecisionEngine(tracks, presetId = DEFAULT_PRESET_ID) {
  const analyzed = tracks.filter((t) => t.analysis);
  if (analyzed.length === 0) {
    return { referenceTrackId: null, referenceReason: null, presetId, targetsByTrack: new Map() };
  }

  const preset = getPreset(presetId);

  const { track: referenceTrack, reason: referenceReason } = determineReferenceTrack(analyzed);
  const eqMovesByTrack = detectMasking(analyzed, referenceTrack, {
    significantShare: preset.maskingSignificantShare,
    cutDb: preset.maskingCutDb,
  });
  const gainByTrack = balanceLevels(analyzed, referenceTrack, {
    targetOffsetDb: preset.levelTargetOffsetDb,
    maxAdjustDb: preset.levelMaxAdjustDb,
  });
  const panByTrack = assignPanning(analyzed, referenceTrack, {
    bassDominantThreshold: preset.panBassDominantThreshold,
    spreadWidth: preset.panSpreadWidth,
  });

  for (const track of analyzed) {
    const gain = gainByTrack.get(track.id);
    const pan = panByTrack.get(track.id);
    const eqMoves = eqMovesByTrack.get(track.id) || [];

    const reasons = [gain.reason, pan.reason, ...eqMoves.map((m) => m.reason)];
    if (track.id === referenceTrack.id) reasons.unshift(`reference track (${referenceReason})`);

    track.targets = {
      gainDb: gain.gainDb,
      pan: pan.pan,
      eqMoves: eqMoves.map((m) => ({ band: m.band, cutDb: m.cutDb })),
      reasons,
    };

    applyOverrides(track, track.targets);
  }

  return {
    referenceTrackId: referenceTrack.id,
    referenceReason,
    presetId,
    targetsByTrack: new Map(analyzed.map((t) => [t.id, t.targets])),
  };
}

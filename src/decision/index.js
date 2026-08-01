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

import { determineReferenceTrack } from './reference.js';
import { detectMasking } from './masking.js';
import { balanceLevels } from './levels.js';
import { assignPanning } from './panning.js';

/**
 * @param {import('../audio/track.js').Track[]} tracks
 * @returns {{referenceTrackId: number|null, referenceReason: string|null, targetsByTrack: Map}}
 */
export function runDecisionEngine(tracks) {
  const analyzed = tracks.filter((t) => t.analysis);
  if (analyzed.length === 0) {
    return { referenceTrackId: null, referenceReason: null, targetsByTrack: new Map() };
  }

  const { track: referenceTrack, reason: referenceReason } = determineReferenceTrack(analyzed);
  const eqMovesByTrack = detectMasking(analyzed, referenceTrack);
  const gainByTrack = balanceLevels(analyzed, referenceTrack);
  const panByTrack = assignPanning(analyzed, referenceTrack);

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
  }

  return {
    referenceTrackId: referenceTrack.id,
    referenceReason,
    targetsByTrack: new Map(analyzed.map((t) => [t.id, t.targets])),
  };
}

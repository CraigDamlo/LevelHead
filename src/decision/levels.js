// Loudness balancing: brings every non-reference track toward a target
// offset below the reference track's average loudness, rather than
// forcing equal loudness — a lead vocal or lead instrument usually
// should sit above the rest, not get matched to it.
//
// targetOffsetDb/maxAdjustDb are parametrized (Phase 7c — genre
// presets, see src/decision/presets.js) so a preset can decide e.g.
// podcast material should sit much closer to equal loudness than a
// rock mix, without touching this file's logic.

const DEFAULT_TARGET_OFFSET_DB = -3; // non-reference tracks aim to sit ~3dB below reference
const DEFAULT_MAX_ADJUST_DB = 6; // clamp so a wildly quiet/loud track doesn't get slammed

/**
 * @param {import('../audio/track.js').Track[]} tracks
 * @param {import('../audio/track.js').Track} referenceTrack
 * @param {{targetOffsetDb?: number, maxAdjustDb?: number}} [params]
 * @returns {Map<number, {gainDb: number, reason: string}>}
 */
export function balanceLevels(tracks, referenceTrack, params = {}) {
  const targetOffsetDb = params.targetOffsetDb ?? DEFAULT_TARGET_OFFSET_DB;
  const maxAdjustDb = params.maxAdjustDb ?? DEFAULT_MAX_ADJUST_DB;

  const gainByTrack = new Map();
  const refDb = referenceTrack.analysis.loudness.averageDb;

  for (const track of tracks) {
    if (track.id === referenceTrack.id) {
      gainByTrack.set(track.id, { gainDb: 0, reason: 'reference track, no adjustment' });
      continue;
    }

    const trackDb = track.analysis.loudness.averageDb;
    const targetDb = refDb + targetOffsetDb;
    let gainDb = isFinite(trackDb) ? targetDb - trackDb : 0;
    gainDb = Math.max(-maxAdjustDb, Math.min(maxAdjustDb, gainDb));

    gainByTrack.set(track.id, {
      gainDb,
      reason:
        `target ${targetDb.toFixed(1)}dB (${targetOffsetDb}dB below reference), ` +
        `was ${isFinite(trackDb) ? trackDb.toFixed(1) : '−∞'}dB, clamped to ±${maxAdjustDb}dB`,
    });
  }

  return gainByTrack;
}

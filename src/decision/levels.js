// Loudness balancing: brings every non-reference track toward a target
// offset below the reference track's average loudness, rather than
// forcing equal loudness — a lead vocal or lead instrument usually
// should sit above the rest, not get matched to it.

const TARGET_OFFSET_DB = -3; // non-reference tracks aim to sit ~3dB below reference
const MAX_GAIN_ADJUST_DB = 6; // clamp so a wildly quiet/loud track doesn't get slammed

/**
 * @param {import('../audio/track.js').Track[]} tracks
 * @param {import('../audio/track.js').Track} referenceTrack
 * @returns {Map<number, {gainDb: number, reason: string}>}
 */
export function balanceLevels(tracks, referenceTrack) {
  const gainByTrack = new Map();
  const refDb = referenceTrack.analysis.loudness.averageDb;

  for (const track of tracks) {
    if (track.id === referenceTrack.id) {
      gainByTrack.set(track.id, { gainDb: 0, reason: 'reference track, no adjustment' });
      continue;
    }

    const trackDb = track.analysis.loudness.averageDb;
    const targetDb = refDb + TARGET_OFFSET_DB;
    let gainDb = isFinite(trackDb) ? targetDb - trackDb : 0;
    gainDb = Math.max(-MAX_GAIN_ADJUST_DB, Math.min(MAX_GAIN_ADJUST_DB, gainDb));

    gainByTrack.set(track.id, {
      gainDb,
      reason:
        `target ${targetDb.toFixed(1)}dB (${TARGET_OFFSET_DB}dB below reference), ` +
        `was ${isFinite(trackDb) ? trackDb.toFixed(1) : '−∞'}dB, clamped to ±${MAX_GAIN_ADJUST_DB}dB`,
    });
  }

  return gainByTrack;
}

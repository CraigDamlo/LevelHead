// Detects frequency-band conflicts ("masking") between tracks using the
// spectral band shares from Phase 2, and produces EQ-cut suggestions for
// the non-reference track(s) in each conflicting band.
//
// v1 approach: for each band, if the reference track's share is above
// significantShare and another track's share in that same band is also
// above significantShare, cut the other track by cutDb in that band.
// This favors the reference track outright rather than splitting the
// difference — simple and predictable, but not true perceptual masking
// modeling (which would weight by loudness and psychoacoustic overlap,
// not just raw spectral share). Revisit if this over- or under-corrects
// on real material.
//
// significantShare/cutDb are parametrized (Phase 7c — genre presets,
// see src/decision/presets.js) rather than fixed constants, so a preset
// can tune how aggressively conflicts get corrected without touching
// this file's logic.

const DEFAULT_SIGNIFICANT_SHARE = 0.15;
const DEFAULT_CUT_DB = -3;

/**
 * @param {import('../audio/track.js').Track[]} tracks - must have .analysis
 * @param {import('../audio/track.js').Track} referenceTrack
 * @param {{significantShare?: number, cutDb?: number}} [params]
 * @returns {Map<number, {band: string, cutDb: number, reason: string}[]>}
 */
export function detectMasking(tracks, referenceTrack, params = {}) {
  const significantShare = params.significantShare ?? DEFAULT_SIGNIFICANT_SHARE;
  const cutDb = params.cutDb ?? DEFAULT_CUT_DB;

  const eqMovesByTrack = new Map();
  for (const track of tracks) eqMovesByTrack.set(track.id, []);

  const refBands = referenceTrack.analysis.spectral.bands;

  for (const track of tracks) {
    if (track.id === referenceTrack.id) continue;

    const bands = track.analysis.spectral.bands;
    for (let i = 0; i < bands.length; i++) {
      const trackBand = bands[i];
      const refBand = refBands[i];

      if (refBand.share >= significantShare && trackBand.share >= significantShare) {
        eqMovesByTrack.get(track.id).push({
          band: trackBand.label,
          cutDb,
          reason:
            `competes with reference "${referenceTrack.name}" in ${trackBand.label} ` +
            `(this track ${(trackBand.share * 100).toFixed(0)}% share, ` +
            `reference ${(refBand.share * 100).toFixed(0)}% share)`,
        });
      }
    }
  }

  return eqMovesByTrack;
}

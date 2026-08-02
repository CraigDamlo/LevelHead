// Panning: bass/sub-dominant tracks and the reference track stay
// centered (low end and lead elements are conventionally centered in a
// mix); everything else spreads evenly across the stereo field in load
// order.
//
// bassDominantThreshold and spreadWidth are parametrized (Phase 7c —
// genre presets, see src/decision/presets.js). spreadWidth scales the
// final spread (1 = full L/R spread, 0 = everything centered) — needed
// separately from bassDominantThreshold because "keep everything
// centered" (e.g. podcast/spoken word, where stereo spread would be
// distracting rather than clarifying) isn't the same claim as "these
// specific tracks are bass-dominant."

const BASS_DOMINANT_BANDS = new Set(['sub', 'bass']);
const DEFAULT_BASS_DOMINANT_THRESHOLD = 0.35; // combined sub+bass share above this stays centered
const DEFAULT_SPREAD_WIDTH = 1.0;

/**
 * @param {import('../audio/track.js').Track[]} tracks
 * @param {import('../audio/track.js').Track} referenceTrack
 * @param {{bassDominantThreshold?: number, spreadWidth?: number}} [params]
 * @returns {Map<number, {pan: number, reason: string}>}
 */
export function assignPanning(tracks, referenceTrack, params = {}) {
  const bassDominantThreshold = params.bassDominantThreshold ?? DEFAULT_BASS_DOMINANT_THRESHOLD;
  const spreadWidth = params.spreadWidth ?? DEFAULT_SPREAD_WIDTH;

  const panByTrack = new Map();

  const bassShareOf = (track) =>
    track.analysis.spectral.bands
      .filter((b) => BASS_DOMINANT_BANDS.has(b.label))
      .reduce((sum, b) => sum + b.share, 0);

  const spreadable = tracks.filter(
    (track) => track.id !== referenceTrack.id && bassShareOf(track) < bassDominantThreshold
  );

  for (const track of tracks) {
    if (track.id === referenceTrack.id) {
      panByTrack.set(track.id, { pan: 0, reason: 'reference track, centered' });
      continue;
    }

    const bassShare = bassShareOf(track);
    if (bassShare >= bassDominantThreshold) {
      panByTrack.set(track.id, {
        pan: 0,
        reason: `bass/sub-dominant (${(bassShare * 100).toFixed(0)}% share), kept centered`,
      });
      continue;
    }

    const index = spreadable.indexOf(track);
    const fullPan = spreadable.length > 1 ? -1 + (2 * index) / (spreadable.length - 1) : 0;
    const pan = fullPan * spreadWidth;
    panByTrack.set(track.id, {
      pan,
      reason:
        `spread ${index + 1} of ${spreadable.length} non-bass tracks` +
        (spreadWidth < 1 ? ` (narrowed to ${Math.round(spreadWidth * 100)}% width)` : ''),
    });
  }

  return panByTrack;
}

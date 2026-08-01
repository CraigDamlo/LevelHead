// Panning: bass/sub-dominant tracks and the reference track stay
// centered (low end and lead elements are conventionally centered in a
// mix); everything else spreads evenly across the stereo field in load
// order.

const BASS_DOMINANT_BANDS = new Set(['sub', 'bass']);
const BASS_DOMINANT_THRESHOLD = 0.35; // combined sub+bass share above this stays centered

/**
 * @param {import('../audio/track.js').Track[]} tracks
 * @param {import('../audio/track.js').Track} referenceTrack
 * @returns {Map<number, {pan: number, reason: string}>}
 */
export function assignPanning(tracks, referenceTrack) {
  const panByTrack = new Map();

  const bassShareOf = (track) =>
    track.analysis.spectral.bands
      .filter((b) => BASS_DOMINANT_BANDS.has(b.label))
      .reduce((sum, b) => sum + b.share, 0);

  const spreadable = tracks.filter(
    (track) => track.id !== referenceTrack.id && bassShareOf(track) < BASS_DOMINANT_THRESHOLD
  );

  for (const track of tracks) {
    if (track.id === referenceTrack.id) {
      panByTrack.set(track.id, { pan: 0, reason: 'reference track, centered' });
      continue;
    }

    const bassShare = bassShareOf(track);
    if (bassShare >= BASS_DOMINANT_THRESHOLD) {
      panByTrack.set(track.id, {
        pan: 0,
        reason: `bass/sub-dominant (${(bassShare * 100).toFixed(0)}% share), kept centered`,
      });
      continue;
    }

    const index = spreadable.indexOf(track);
    const pan = spreadable.length > 1 ? -1 + (2 * index) / (spreadable.length - 1) : 0;
    panByTrack.set(track.id, {
      pan,
      reason: `spread ${index + 1} of ${spreadable.length} non-bass tracks`,
    });
  }

  return panByTrack;
}

// Determines the reference ("lead") track that other tracks get balanced
// against — masking conflicts resolve in its favor, levels are set
// relative to it, and it stays centered in the pan field.
//
// Decision (from the project owner, session 3): the lead should be
// manually marked in the UI, not auto-detected — auto-detection (e.g.
// "loudest track") doesn't reliably match musical intent (a quiet lead
// vocal over a loud mix is common). Manual marking is the primary path.
//
// A fallback to loudest-by-average-loudness is kept for the case where
// no track is marked yet, purely so the engine produces *something*
// inspectable rather than nothing — this is not meant to be a good
// default, just a non-broken one. The UI should make it obvious when
// the fallback is active (see reason string) and nudge toward marking
// a real lead.

export function determineReferenceTrack(tracks) {
  const marked = tracks.find((t) => t.isLead);
  if (marked) {
    return { track: marked, reason: 'manually marked as lead' };
  }

  let loudest = tracks[0];
  for (const track of tracks) {
    if (track.analysis.loudness.averageDb > loudest.analysis.loudness.averageDb) {
      loudest = track;
    }
  }
  return {
    track: loudest,
    reason: 'no lead marked — defaulted to loudest track (mark a lead in the UI for better results)',
  };
}

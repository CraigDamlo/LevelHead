// Reads a real-time RMS level (roughly 0-1 for typical program material,
// can exceed 1 on hot signals) from an AnalyserNode tapped off a track's
// processing chain — see the analyserNode returned by
// src/processing/trackChain.js's buildTrackChain().
//
// Uses time-domain data (actual waveform samples), not the analyser's
// frequency-domain data — this is a loudness meter, not a spectrum
// display. Kept as a pure function (analyser in, number out) so it's
// easy to call from a render loop without this module needing to know
// anything about the DOM.

export function readLevel(analyserNode) {
  const buffer = new Float32Array(analyserNode.fftSize);
  analyserNode.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

// Analysis works on a mono mixdown of each track rather than per-channel
// data. Simplifies loudness/spectral/transient code considerably, and for
// mixing-decision purposes (this is what's competing for space with what)
// per-channel detail isn't needed — panning decisions happen later in
// Phase 3 using this same mono profile plus the track's channel count.

export function toMono(audioBuffer) {
  const { numberOfChannels, length } = audioBuffer;
  const mono = new Float32Array(length);

  if (numberOfChannels === 1) {
    mono.set(audioBuffer.getChannelData(0));
    return mono;
  }

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / numberOfChannels;
    }
  }
  return mono;
}

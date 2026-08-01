// Shared mix bus: every track's processed output feeds into this one
// DynamicsCompressorNode before hitting the speakers. A single shared
// bus compressor (not per-track) — this is deliberately simple glue
// compression to stop the summed signal from clipping when several
// tracks combine past 0dB, not meant to be a mastering-grade limiter.
// Revisit only if clipping/pumping is actually audible on real material.

const COMPRESSOR_SETTINGS = {
  threshold: -12, // dB — starts compressing once the sum gets this loud
  knee: 6,
  ratio: 3,
  attack: 0.01,
  release: 0.2,
};

/**
 * @param {AudioContext} context
 * @returns {DynamicsCompressorNode} already connected to context.destination
 *   — use this node as the connection target for each track's chain.
 */
export function createBus(context) {
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = COMPRESSOR_SETTINGS.threshold;
  compressor.knee.value = COMPRESSOR_SETTINGS.knee;
  compressor.ratio.value = COMPRESSOR_SETTINGS.ratio;
  compressor.attack.value = COMPRESSOR_SETTINGS.attack;
  compressor.release.value = COMPRESSOR_SETTINGS.release;
  compressor.connect(context.destination);
  return compressor;
}

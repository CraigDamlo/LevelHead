// Renders the current mix offline (via OfflineAudioContext) into a
// single AudioBuffer. Deliberately reuses the exact same per-track
// chain and bus logic as live playback — buildTrackChain() and
// createBus() from src/processing/ — because both accept a generic
// Web Audio context (AudioContext or OfflineAudioContext, the two
// share the relevant API surface). Export should always sound
// identical to what "Play mix" produces, since it's the same code
// path, not a separate rendering implementation that could drift.
//
// Assumes all loaded tracks share a sample rate. This holds in
// practice because every track is decoded through the single shared
// AudioContext (see audio/loader.js), and decodeAudioData always
// resamples to that context's native rate — so there's nothing to
// reconcile here. If tracks are ever loaded through more than one
// context, this assumption breaks and needs revisiting.

import { getAudioContext } from '../audio/loader.js';
import { buildTrackChain } from './trackChain.js';
import { createBus } from './bus.js';

/**
 * @param {import('../audio/track.js').Track[]} tracks
 * @returns {Promise<AudioBuffer>}
 */
export async function renderMix(tracks) {
  const playable = tracks.filter((t) => t.targets);
  if (playable.length === 0) {
    throw new Error('No tracks ready to render — load audio and let analysis/decisions run first');
  }

  const sampleRate = getAudioContext().sampleRate;
  const maxDuration = Math.max(...playable.map((t) => t.duration));
  const length = Math.ceil(sampleRate * maxDuration);

  const offlineContext = new OfflineAudioContext(2, length, sampleRate);
  const bus = createBus(offlineContext);
  const chains = playable.map((track) => buildTrackChain(offlineContext, track, bus));
  for (const chain of chains) chain.start(0);

  return offlineContext.startRendering();
}

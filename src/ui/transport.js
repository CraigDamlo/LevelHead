// Manages Web Audio playback state for the current mix: building the
// per-track chains, starting/pausing/stopping them, and tracking
// elapsed time. Deliberately knows nothing about the DOM — main.js (or
// a future src/ui/index.js) is responsible for reflecting this state
// visually.
//
// Pause/resume uses AudioContext.suspend()/resume() rather than
// stopping and restarting nodes. This works because Web Audio timing is
// driven entirely by context.currentTime, which itself freezes while
// the context is suspended — so every node's playback position freezes
// too, and resuming picks back up exactly where it left off. This only
// works because there's a single shared AudioContext for the whole mix
// (see audio/loader.js); if a future phase needs independent per-track
// pause, this approach won't extend to that without real rework.

import { getAudioContext } from '../audio/loader.js';
import { buildTrackChain } from '../processing/trackChain.js';
import { createBus } from '../processing/bus.js';

/**
 * @returns {{
 *   play: (tracks: import('../audio/track.js').Track[]) => boolean,
 *   pause: () => void,
 *   stop: () => void,
 *   getStatus: () => 'stopped'|'playing'|'paused',
 *   getElapsedSeconds: () => number,
 *   getChains: () => object[],
 *   onEnded: (callback: () => void) => void,
 * }}
 */
export function createTransport() {
  let chains = [];
  let bus = null;
  let status = 'stopped';
  let startContextTime = 0;
  let stopTimeoutId = null;
  let onEndedCallback = null;

  function play(tracks) {
    if (status === 'paused') {
      getAudioContext().resume();
      status = 'playing';
      return true;
    }

    const playable = tracks.filter((t) => t.targets);
    if (playable.length === 0) return false;

    const context = getAudioContext();
    bus = createBus(context);
    chains = playable.map((track) => {
      const chain = buildTrackChain(context, track, bus);
      chain.trackId = track.id; // lets UI code (meters) map chains back to track rows
      return chain;
    });

    startContextTime = context.currentTime + 0.05;
    for (const chain of chains) chain.start(startContextTime);

    status = 'playing';

    const maxDuration = Math.max(...playable.map((t) => t.duration));
    clearStopTimeout();
    stopTimeoutId = setTimeout(() => {
      stop();
      if (onEndedCallback) onEndedCallback();
    }, (maxDuration + 0.2) * 1000);

    return true;
  }

  function pause() {
    if (status !== 'playing') return;
    getAudioContext().suspend();
    status = 'paused';
  }

  function stop() {
    clearStopTimeout();
    for (const chain of chains) chain.stop();
    if (bus) bus.disconnect();

    // If the context was left suspended (paused, then stopped rather
    // than resumed), resume it now — otherwise the *next* play() call
    // would start from a suspended context and produce silence.
    const context = getAudioContext();
    if (context.state === 'suspended') context.resume();

    chains = [];
    bus = null;
    status = 'stopped';
  }

  function clearStopTimeout() {
    if (stopTimeoutId) {
      clearTimeout(stopTimeoutId);
      stopTimeoutId = null;
    }
  }

  function getStatus() {
    return status;
  }

  function getElapsedSeconds() {
    if (status === 'stopped') return 0;
    return Math.max(0, getAudioContext().currentTime - startContextTime);
  }

  function getChains() {
    return chains;
  }

  function onEnded(callback) {
    onEndedCallback = callback;
  }

  return { play, pause, stop, getStatus, getElapsedSeconds, getChains, onEnded };
}

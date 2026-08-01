// Transient detection: short-window (10ms) RMS envelope, flagging an
// onset wherever energy spikes well above a running local average.
// Deliberately simple peak-picking rather than spectral flux — good
// enough for v1 to know roughly where hits/attacks land (useful context
// for Phase 3 decisions later), not meant to be sample-accurate beat
// detection.

import { toMono } from './shared.js';

const ENVELOPE_WINDOW_SECONDS = 0.01;
const MIN_ONSET_GAP_SECONDS = 0.05;
const THRESHOLD_FACTOR = 1.5;
const MIN_ABSOLUTE_LEVEL = 0.01; // ignore "onsets" in near-silence
const SMOOTHING = 0.9; // running-average decay for the local baseline

export function detectTransients(audioBuffer) {
  const mono = toMono(audioBuffer);
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = Math.max(1, Math.floor(ENVELOPE_WINDOW_SECONDS * sampleRate));

  const envelope = [];
  for (let start = 0; start < mono.length; start += windowSize) {
    const end = Math.min(start + windowSize, mono.length);
    let sum = 0;
    for (let i = start; i < end; i++) sum += mono[i] * mono[i];
    envelope.push(Math.sqrt(sum / (end - start)));
  }

  const onsets = [];
  let lastOnsetTime = -Infinity;
  let runningAvg = envelope[0] || 0;

  for (let i = 1; i < envelope.length; i++) {
    const value = envelope[i];
    const time = (i * windowSize) / sampleRate;

    if (value > runningAvg * THRESHOLD_FACTOR && value > MIN_ABSOLUTE_LEVEL) {
      if (time - lastOnsetTime >= MIN_ONSET_GAP_SECONDS) {
        onsets.push({ time, strength: value });
        lastOnsetTime = time;
      }
    }

    runningAvg = runningAvg * SMOOTHING + value * (1 - SMOOTHING);
  }

  return { onsets, count: onsets.length };
}

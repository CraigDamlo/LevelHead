// Short-term loudness via windowed RMS. This is a stand-in for true LUFS
// (which needs K-weighting and gated integration) — RMS-over-400ms is
// close enough for balancing tracks against each other in Phase 3 and is
// much simpler to verify by hand. Revisit if the rule engine's level
// decisions end up not matching what your ears expect.

import { toMono } from './shared.js';

const WINDOW_SECONDS = 0.4;

export function analyzeLoudness(audioBuffer) {
  const mono = toMono(audioBuffer);
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = Math.max(1, Math.floor(WINDOW_SECONDS * sampleRate));

  const curve = [];
  let sumSquares = 0;
  let totalSamples = 0;

  for (let start = 0; start < mono.length; start += windowSize) {
    const end = Math.min(start + windowSize, mono.length);
    let windowSum = 0;
    for (let i = start; i < end; i++) {
      windowSum += mono[i] * mono[i];
    }
    const rms = Math.sqrt(windowSum / (end - start));
    curve.push({ time: start / sampleRate, rms, db: rmsToDb(rms) });

    sumSquares += windowSum;
    totalSamples += end - start;
  }

  const averageRms = totalSamples > 0 ? Math.sqrt(sumSquares / totalSamples) : 0;

  return {
    curve,
    averageRms,
    averageDb: rmsToDb(averageRms),
  };
}

function rmsToDb(rms) {
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

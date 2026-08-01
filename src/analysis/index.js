// Orchestrates the Phase 2 analysis pipeline: runs loudness, spectral,
// and transient analysis on a track and stores the combined report on
// track.analysis.
//
// Synchronous and CPU-bound. Fine for track lengths in the minutes
// range on modern hardware, but if this starts noticeably blocking the
// UI on longer files, this is the place to move work into a Web Worker
// — don't add that complexity preemptively.

import { analyzeLoudness } from './loudness.js';
import { analyzeSpectrum } from './spectral.js';
import { detectTransients } from './transients.js';

/**
 * @param {import('../audio/track.js').Track} track
 * @returns {{loudness: object, spectral: object, transients: object}}
 */
export function analyzeTrack(track) {
  const loudness = analyzeLoudness(track.audioBuffer);
  const spectral = analyzeSpectrum(track.audioBuffer);
  const transients = detectTransients(track.audioBuffer);

  track.analysis = { loudness, spectral, transients };
  return track.analysis;
}

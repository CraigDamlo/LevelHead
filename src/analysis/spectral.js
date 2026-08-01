// Spectral analysis: windowed FFT (Hann window, 2048 samples, 50%
// overlap) averaged across the whole track, then bucketed into
// roughly-octave bands. A single averaged spectrum per track — not a
// time-varying one — is enough for Phase 3's masking detection (which
// asks "do these two tracks compete for the same band, in general") and
// keeps this fast and simple. If later phases need time-varying spectral
// conflict detection (e.g. only duck the bass when the kick actually
// hits), that's a deliberate scope increase, not an oversight — revisit
// this file's averaging approach then.

import { toMono } from './shared.js';
import { fft, magnitude } from './fft.js';

const FFT_SIZE = 2048;
const HOP_SIZE = FFT_SIZE / 2;

const BANDS = [
  { label: 'sub', low: 20, high: 60 },
  { label: 'bass', low: 60, high: 250 },
  { label: 'low-mid', low: 250, high: 500 },
  { label: 'mid', low: 500, high: 2000 },
  { label: 'high-mid', low: 2000, high: 4000 },
  { label: 'presence', low: 4000, high: 6000 },
  { label: 'air', low: 6000, high: 20000 },
];

export function analyzeSpectrum(audioBuffer) {
  const mono = toMono(audioBuffer);
  const sampleRate = audioBuffer.sampleRate;
  const hann = hannWindow(FFT_SIZE);
  const binCount = FFT_SIZE / 2;
  const avgMagnitude = new Float64Array(binCount);
  let windowCount = 0;

  for (let start = 0; start + FFT_SIZE <= mono.length; start += HOP_SIZE) {
    const real = new Float32Array(FFT_SIZE);
    const imag = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      real[i] = mono[start + i] * hann[i];
    }
    fft(real, imag);
    const mag = magnitude(real, imag);
    for (let b = 0; b < binCount; b++) avgMagnitude[b] += mag[b];
    windowCount++;
  }

  if (windowCount === 0) {
    // Track shorter than one FFT window (2048 samples, ~46ms @ 44.1kHz)
    // — pad with silence and do a single pass rather than skipping
    // analysis entirely.
    const real = new Float32Array(FFT_SIZE);
    const imag = new Float32Array(FFT_SIZE);
    for (let i = 0; i < mono.length; i++) real[i] = mono[i] * hann[i];
    fft(real, imag);
    const mag = magnitude(real, imag);
    for (let b = 0; b < binCount; b++) avgMagnitude[b] = mag[b];
    windowCount = 1;
  }

  for (let b = 0; b < binCount; b++) avgMagnitude[b] /= windowCount;

  const bands = BANDS.map(({ label, low, high }) => {
    const loBin = Math.max(1, Math.floor((low / sampleRate) * FFT_SIZE));
    const hiBin = Math.min(binCount - 1, Math.ceil((high / sampleRate) * FFT_SIZE));
    let sum = 0;
    let count = 0;
    for (let b = loBin; b <= hiBin; b++) {
      sum += avgMagnitude[b];
      count++;
    }
    return { label, low, high, energy: count > 0 ? sum / count : 0 };
  });

  const totalEnergy = bands.reduce((sum, b) => sum + b.energy, 0) || 1;
  for (const b of bands) b.share = b.energy / totalEnergy;

  return { bands };
}

function hannWindow(size) {
  const win = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return win;
}

// Minimal iterative radix-2 Cooley-Tukey FFT, in place on real/imag
// arrays. Size must be a power of two.
//
// Analysis runs once per track on load, not per audio frame, so this
// prioritizes being simple and easy to verify over being fast. If
// analysis ever becomes a bottleneck on long files, this is the first
// place to optimize (or move to a Web Worker) — not before.

export function fft(real, imag) {
  const n = real.length;
  if (n !== imag.length) throw new Error('real/imag length mismatch');
  if (n & (n - 1)) throw new Error('FFT size must be a power of two');

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wR = Math.cos(angle);
    const wI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curR = 1;
      let curI = 0;
      const half = len / 2;
      for (let k = 0; k < half; k++) {
        const uR = real[i + k];
        const uI = imag[i + k];
        const vR = real[i + k + half] * curR - imag[i + k + half] * curI;
        const vI = real[i + k + half] * curI + imag[i + k + half] * curR;
        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;
        real[i + k + half] = uR - vR;
        imag[i + k + half] = uI - vI;
        const nextR = curR * wR - curI * wI;
        const nextI = curR * wI + curI * wR;
        curR = nextR;
        curI = nextI;
      }
    }
  }
}

export function magnitude(real, imag) {
  const out = new Float32Array(real.length);
  for (let i = 0; i < real.length; i++) {
    out[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return out;
}

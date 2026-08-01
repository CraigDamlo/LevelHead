# Progress

Read this first. Checklist mirrors the phases in `AI_BUILD_GUIDE.md`.
Update it before ending any session — check off finished items and add a
session log entry, even a short one.

## Checklist

- [x] Phase 0 — Scaffold
- [x] Phase 1 — Audio loading
- [x] Phase 2 — Analysis pipeline
- [ ] Phase 3 — Decision engine
- [ ] Phase 4 — Processing chain
- [ ] Phase 5 — UI: meters and playback
- [ ] Phase 6 — UI: manual overrides
- [ ] Phase 7+ — Polish (not yet planned in detail)

## Current focus

Phase 3 — Decision engine. Not started.

## Session log

Newest entry at the top. Keep entries short: what changed, what's
half-done, what to do next, any open decisions.

---

**Session 2 (Phase 2 — analysis pipeline)**
Implemented all three analysis passes plus an orchestrator:
- `src/analysis/shared.js` — mixes multichannel audio to mono for
  analysis (deliberate simplification; documented in-file).
- `src/analysis/fft.js` — small iterative radix-2 Cooley-Tukey FFT,
  written from scratch (no dependency). Verified against a known 1kHz
  sine wave — peak bin lands within one bin-width of expected.
- `src/analysis/loudness.js` — RMS over 400ms windows, not true LUFS
  (documented as a conscious simplification; revisit only if Phase 3's
  level decisions don't match expectations by ear).
- `src/analysis/spectral.js` — Hann-windowed FFT (2048 samples, 50%
  overlap), averaged across the whole track into 7 roughly-octave bands
  (sub/bass/low-mid/mid/high-mid/presence/air). One averaged spectrum
  per track, not time-varying — sufficient for Phase 3 masking checks.
- `src/analysis/transients.js` — 10ms RMS envelope with running-average
  baseline, flags onsets where energy spikes 1.5x the local baseline.
  Simple peak-picking, not spectral flux.
- `src/analysis/index.js` — orchestrates all three, stores result on
  `track.analysis`.

Verified end-to-end with a synthetic AudioBuffer-like object (200Hz tone
+ silence + an injected click) run outside the browser via Node: bass
band correctly dominates, the injected click is correctly detected as
the only transient. Real browser testing with actual music files not
yet done — worth doing before Phase 3, since real material has far more
spectral complexity than a pure sine wave.

Wired into `main.js`: analysis runs automatically right after a track
loads, logs the full report to console, and the track list shows a
lightweight "avg dB · N onsets" readout (not real meters — that's still
Phase 5). This is synchronous and blocks briefly per track; fine at
current scale, revisit (Web Worker) only if it's actually slow on real
files.

Next: Phase 3 — decision engine. Start with `src/decision/masking.js` —
compare `track.analysis.spectral.bands` across all loaded tracks,
identify bands where multiple tracks have high `share`, and produce a
gain-offset-per-band suggestion for the less important track(s). Needs
a notion of "which track is more important" — for v1, simplest option
is treating the first-loaded or loudest track as the reference/lead and
resolving conflicts in its favor; open decision, make a call and
document it in the file.

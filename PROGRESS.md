# Progress

Read this first. Checklist mirrors the phases in `AI_BUILD_GUIDE.md`.
Update it before ending any session — check off finished items and add a
session log entry, even a short one.

## Checklist

- [x] Phase 0 — Scaffold
- [x] Phase 1 — Audio loading
- [ ] Phase 2 — Analysis pipeline
- [ ] Phase 3 — Decision engine
- [ ] Phase 4 — Processing chain
- [ ] Phase 5 — UI: meters and playback
- [ ] Phase 6 — UI: manual overrides
- [ ] Phase 7+ — Polish (not yet planned in detail)

## Current focus

Phase 2 — Analysis pipeline. Not started.

## Session log

Newest entry at the top. Keep entries short: what changed, what's
half-done, what to do next, any open decisions.

---

**Session 1 (Phase 1 — audio loading)**
Implemented `src/audio/track.js` (plain Track class holding an
AudioBuffer + metadata, with `analysis`/`targets` fields left null for
later phases) and `src/audio/loader.js` (shared lazily-created
AudioContext, `loadFile`/`loadFiles` using `decodeAudioData`,
`Promise.allSettled` so one bad file doesn't block the rest). Wired it
into `main.js` with a drag-and-drop + click-to-browse zone in
`index.html`; loaded tracks render as a simple list with name/duration/
channels/sample rate, decode errors show inline.

No processing or playback yet — tracks just sit in memory as decoded
AudioBuffers. Smoke-tested that all files serve correctly over a local
static server; haven't tested actual file decoding in a real browser yet
(worth doing before starting Phase 2 — try a couple of real audio files
of different formats/channel counts).

Next: Phase 2 — analysis pipeline. Start with `src/analysis/loudness.js`
(RMS over ~400ms windows is fine for v1, don't over-engineer true LUFS
yet) using an `OfflineAudioContext` per track. Decide there whether to
do spectral analysis via `AnalyserNode` inside an OfflineAudioContext or
a manual FFT — document whichever is chosen in that file's comments so
it doesn't need re-deciding next session.

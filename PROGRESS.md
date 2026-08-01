# Progress

Read this first. Checklist mirrors the phases in `AI_BUILD_GUIDE.md`.
Update it before ending any session — check off finished items and add a
session log entry, even a short one.

## Checklist

- [x] Phase 0 — Scaffold
- [x] Phase 1 — Audio loading
- [x] Phase 2 — Analysis pipeline
- [x] Phase 3 — Decision engine
- [x] Phase 4 — Processing chain
- [ ] Phase 4 — Processing chain
- [ ] Phase 5 — UI: meters and playback
- [ ] Phase 6 — UI: manual overrides
- [ ] Phase 7+ — Polish (not yet planned in detail)

## Current focus

Phase 5 — UI: meters and playback. Partially started (see below) — a
minimal play/stop already exists from Phase 4; real transport polish
and meters are still open.

## Session log

Newest entry at the top. Keep entries short: what changed, what's
half-done, what to do next, any open decisions.

---

**Session 4 (Phase 4 — processing chain)**
Implemented the actual Web Audio graph:
- `src/processing/bus.js` — `createBus(context)`, a single shared
  `DynamicsCompressorNode` (threshold -12dB, ratio 3:1) connected to
  `context.destination`. Simple glue compression to stop summed tracks
  clipping, not a mastering limiter — documented as intentionally basic.
- `src/processing/trackChain.js` — `buildTrackChain(context, track,
  destination)` builds source → gain → [peaking EQ filter per masking
  cut] → panner → destination per track, reading values straight from
  `track.targets` (gain in dB converted to linear, EQ moves mapped from
  band label to an approximate center frequency, pan applied directly).
  Falls back to neutral values if `.targets` isn't set yet.

Verified node wiring order and parameter math with a mocked Web Audio
context in Node (no real AudioContext available outside a browser) —
confirmed the connection chain is source→gain→eq→panner→destination in
that order, and that gain/pan/EQ frequency/EQ gain values all match
what the decision engine produced. This only proves the *code* is
correct, not that it *sounds* right — that needs real ears in a real
browser.

Added a minimal play/stop control ahead of full Phase 5 — this wasn't
optional, since Phase 4's own definition of done ("audibly different
result") requires *something* to trigger playback with. `main.js` now
has `playMix()`/`stopMix()`: builds fresh chains for every track with
`.targets` set, starts them together ~50ms in the future (small buffer
for scheduling), and auto-stops when the longest track ends. Because
`AudioBufferSourceNode` is one-shot, there's no pause/resume — every
play rebuilds from scratch. Marking a new lead track while something is
playing stops it first, since the old chain's EQ/gain nodes are already
locked to the previous targets.

**This has not been tested with real audio in a real browser yet** —
only synthetic tracks and mocked Web Audio nodes, since neither is
available in this environment. Testing with actual multitrack material
by ear is the critical next step, ideally before adding any more
features on top, since it's the first point where "does this sound
good" can actually be evaluated instead of inferred from numbers.

Not done: no pause (only stop+restart), no scrubbing/seek, no visual
playhead, no per-track mute/solo, no meters. All squarely Phase 5.

Next: Phase 5 — UI: meters and playback. The play/stop button from this
session covers the "playback" half loosely; focus next session on
level meters (even a simple static per-track peak/RMS readout counts
for v1 — doesn't need to be live-updating at first) and showing the
decision engine's reasoning more visibly than a button tooltip (a
proper panel, not `title=`). Real-browser testing with actual audio
should happen before or alongside this session, not after.

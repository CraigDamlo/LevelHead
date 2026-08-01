# Progress

Read this first. Checklist mirrors the phases in `AI_BUILD_GUIDE.md`.
Update it before ending any session — check off finished items and add a
session log entry, even a short one.

## Checklist

- [x] Phase 0 — Scaffold
- [x] Phase 1 — Audio loading
- [x] Phase 2 — Analysis pipeline
- [x] Phase 3 — Decision engine
- [ ] Phase 4 — Processing chain
- [ ] Phase 5 — UI: meters and playback
- [ ] Phase 6 — UI: manual overrides
- [ ] Phase 7+ — Polish (not yet planned in detail)

## Current focus

Phase 4 — Processing chain. Not started.

## Session log

Newest entry at the top. Keep entries short: what changed, what's
half-done, what to do next, any open decisions.

---

**Session 3 (Phase 3 — decision engine)**
Open decision from last session — how to pick the reference/lead track
— resolved: **manual marking in the UI**, not auto-detection. Implemented:

- `src/decision/reference.js` — `determineReferenceTrack()`. Uses the
  manually-marked track (`track.isLead`) if one exists; falls back to
  loudest-by-average-dB only so the engine isn't broken with nothing
  marked yet. The fallback reason string says as much, and the UI should
  keep nudging toward marking a real lead (it currently does, via the
  "Mark lead" button always being visible).
- `src/decision/masking.js` — per-band conflict detection between the
  reference and every other track; cuts the non-reference track 3dB in
  any band where both tracks have ≥15% spectral share.
- `src/decision/levels.js` — targets each non-reference track to sit
  3dB below the reference's average loudness, clamped to ±6dB gain
  adjustment.
- `src/decision/panning.js` — bass/sub-dominant tracks (≥35% combined
  share) and the reference stay centered; everything else spreads
  evenly across the stereo field.
- `src/decision/index.js` — orchestrates all of the above, stores
  `track.targets = { gainDb, pan, eqMoves, reasons }` on each track.
  Every decision carries a human-readable reason string end to end.

Verified with synthetic vocal/bass/guitar tracks outside the browser
(Node): marked-lead vocal correctly won reference status, the
mid-range-competing guitar got the expected EQ cut, the loud bass got
pulled down in level while staying centered. All three checks passed.

UI: added a "Mark lead" / "★ Lead" toggle button per track row (click
to mark; only one track can be lead at a time). Track rows show gain/
pan/EQ-cut-count once the decision engine has run, and the reason
strings are available as a title/tooltip on the lead button for now —
a real "why" panel is Phase 5/6 UI work, this is just enough to verify
the engine is doing something sensible by eye.

Not yet tested with real audio/real multitrack material — only
synthetic tones. Worth doing before Phase 4, since real spectral
content is messier than pure sine waves and might reveal the 15%-share
masking threshold or the 3dB cut amount need tuning.

Next: Phase 4 — processing chain. Build `src/processing/trackChain.js`
(per-track GainNode → BiquadFilterNode(s) for the EQ cuts → StereoPannerNode)
and `src/processing/bus.js` (sums all tracks into a shared
DynamicsCompressorNode → destination). Apply each track's `.targets`
directly to the corresponding audio params. This is the first phase
where something is actually audible — good point to sanity-check the
whole pipeline by ear on a real multitrack recording.

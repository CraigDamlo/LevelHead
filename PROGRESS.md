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
- [x] Phase 5 — UI: meters and playback
- [ ] Phase 4 — Processing chain
- [ ] Phase 5 — UI: meters and playback
- [ ] Phase 6 — UI: manual overrides
- [ ] Phase 7+ — Polish (not yet planned in detail)

## Current focus

Phase 6 — UI: manual overrides. Not started.

## Session log

Newest entry at the top. Keep entries short: what changed, what's
half-done, what to do next, any open decisions.

---

**Session 5 (Phase 5 — UI: meters and playback)**
Implemented real transport, level meters, and a reasoning panel:

- `src/ui/transport.js` — `createTransport()`, a DOM-agnostic playback
  state machine (`stopped`/`playing`/`paused`). **Real pause**, not
  stop-and-restart: uses `AudioContext.suspend()`/`resume()`, which
  works because Web Audio timing is entirely driven by
  `context.currentTime`, and that freezes while suspended — so every
  node's playback position freezes too, and resume picks up exactly
  where it left off. Documented in-file, including the caveat that this
  approach doesn't extend to per-track independent pause if that's ever
  needed. Tagged each built chain with `chain.trackId` so UI code can
  map audio chains back to track rows (needed for meters).
- `src/ui/meters.js` — `readLevel(analyserNode)`, pure function reading
  time-domain RMS (loudness, not spectrum) from an AnalyserNode.
- `src/processing/trackChain.js` — added an `AnalyserNode` tapped in
  parallel off each track's panner output (doesn't affect the main
  signal path — Web Audio nodes can feed multiple destinations).
- `main.js` — full rewrite of the transport wiring: separate Play /
  Pause / Stop buttons reflecting transport status, an elapsed-time
  readout updated via `requestAnimationFrame`, and live per-track meter
  bars (width-based, not canvas — simple and sufficient here) reading
  from each chain's analyser on the same rAF loop.
- Reasoning panel: replaced the old button-tooltip with a proper
  `<details>/<summary>` "Why these settings?" panel under each track
  row, listing every reason string from `track.targets.reasons`.

Verified with mocked Web Audio contexts in Node (no browser available
here): transport state transitions (stopped→playing→paused→playing→
stopped) all behave correctly, including the important edge case of
stopping while paused correctly resuming the context first (otherwise
the *next* play() would start from a suspended context and produce
silence). Also verified `readLevel()`'s RMS math against a known
full-scale sine wave (expected ~0.707, got 0.707).

Also cleaned up a leftover orphaned CSS fragment in `index.html` from
an earlier session's sed edit (a stray `font-size: 14px; }` with no
selector, harmless but sloppy — worth a quick visual diff check after
any future sed-based edits, not just grep for the target string).

**Still needs real-browser testing with real audio** — this note has
carried over from Phase 4 and is now more overdue, since meters and
pause are the kind of thing that's easy to get subtly wrong in ways
mocks can't catch (e.g. does the meter bar actually look responsive at
60fps, does pause feel instant or laggy). Please test before Phase 6.

Not done: no scrubbing/seek, no per-track mute/solo, no visual
playhead/timeline (only elapsed time as text). None of these are
required for MVP; revisit only if they turn out to matter in practice.

Next: Phase 6 — manual overrides. Needs `src/decision/overrides.js` to
track which parameters are user-locked vs. automatic, so that
re-running the decision engine (e.g. after changing the lead track)
doesn't stomp on a manual adjustment. UI-wise, the simplest starting
point is probably a draggable gain slider per track that, once touched,
marks that track's gain as locked — pan and EQ overrides can follow
the same pattern once gain override works end to end. Decide there
whether "locked" is per-parameter (gain/pan/EQ independently) or
all-or-nothing per track; per-parameter is more flexible but more UI
and state to manage — make a call and document it in the file, same as
prior phases.

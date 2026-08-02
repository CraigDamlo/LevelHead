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
- [x] Phase 6 — UI: manual overrides
- [x] Phase 7a — Export to WAV
- [x] Phase 7c — Genre presets
- [ ] Phase 4 — Processing chain
- [ ] Phase 5 — UI: meters and playback
- [ ] Phase 6 — UI: manual overrides
- [ ] Phase 7+ — Polish (not yet planned in detail)

## Current focus

Phase 7b (save/load session) is the last originally-discussed Phase 7
candidate. Real-browser testing is still the single most overdue item
— now carried across five sessions (4, 5, 6, 7a, 7c). Please prioritize
this over any further feature work.

## Session log

Newest entry at the top. Keep entries short: what changed, what's
half-done, what to do next, any open decisions.

---

**Session 8 (Phase 7c — genre presets)**
Parametrized the three decision rules rather than adding new rule
logic — each of `detectMasking()`, `balanceLevels()`, `assignPanning()`
now accepts an optional `params` object (masking share/cut thresholds,
level offset/clamp, pan bass-threshold/spread-width) with the exact
same defaults as before if omitted, so this was a non-breaking change.

- `src/decision/presets.js` — five presets (default, band, electronic,
  acoustic, podcast), each a named parameter set with a plain-language
  description. Values are reasoned-about starting points, not measured
  against real mixes — documented as such, expect to need tuning by ear.
  Notably, podcast's `panSpreadWidth: 0` needed a genuinely new
  parameter (not just reusing `bassDominantThreshold`) since "keep
  everything centered" and "these tracks are bass-heavy" are different
  claims — panning.js now scales its spread by this factor.
- `src/decision/index.js` — `runDecisionEngine(tracks, presetId)`,
  defaults to `'default'` preset if omitted (backward compatible with
  every prior caller/test). Resolves the preset once per run and
  threads its parameters into each rule call.
- `main.js` — added a preset `<select>` populated from `PRESETS`, with
  a description line that updates on change. Changing preset stops any
  live playback first (same pattern as changing the lead track) since
  the old chain would otherwise be playing stale targets.

**Also did the main.js split that's been deferred twice** (see the
note that used to live at the top of that file): the preset selector
was explicitly the "second chunk of UI logic" the deferral note said
would trigger it. Pulled all track-row rendering — meters, override
sliders, reasoning panel — into `src/ui/trackList.js`. It's callback-
based (takes handlers for onSetLead/onGainCommit/etc.) rather than
importing decision/transport modules directly, so it only touches the
DOM and stays testable independent of the rest of the app's wiring.
`main.js` is now purely state + event wiring, calling
`renderTrackList()` instead of a giant inline function.

Verified in Node: regression-checked that the `default` preset
reproduces the exact pre-preset numbers from session 3/6's tests
(-3dB cut, unchanged); confirmed all five presets produce genuinely
different masking/level/pan numbers on the same synthetic input, not
just cosmetically different config that doesn't actually flow through;
confirmed podcast's `spreadWidth: 0` actually centers pan; confirmed
manual overrides (Phase 6) and presets compose correctly together —
an override survives both a preset switch and the backward-compatible
no-presetId call signature.

**Still zero real-browser testing across five sessions now.** This
note is being repeated verbatim on purpose — the pattern of "verified
in Node, ship it, defer testing" has now produced a genre-preset
dropdown, an export button, override sliders, and real pause, none of
which have been touched by an actual mouse in an actual browser. None
of the Node-side verification can catch UI/UX issues (does the preset
dropdown feel responsive, does switching presets mid-listening feel
jarring, does the description text update correctly) — only real use
can. Strongly recommend a testing pass before Phase 7b or anything else.

Next: Phase 7b (save/load session) is the last undone Phase 7
candidate from the original three. It's a bigger decision than 7a/7c
were — needs to decide on a storage mechanism (localStorage can't hold
audio file data, so a session save likely can't include the actual
audio and would need the user to re-select the same files, or use the
File System Access API to keep file handles — that's a real design
question, not an implementation detail, worth surfacing explicitly
next session rather than picking silently).

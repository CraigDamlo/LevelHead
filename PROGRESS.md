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
- [ ] Phase 4 — Processing chain
- [ ] Phase 5 — UI: meters and playback
- [ ] Phase 6 — UI: manual overrides
- [ ] Phase 7+ — Polish (not yet planned in detail)

## Current focus

Phase 7+ — Polish / TBD. All core MVP phases (0–6) are now complete.
Nothing planned in detail yet — see "Next" below for candidates.

## Session log

Newest entry at the top. Keep entries short: what changed, what's
half-done, what to do next, any open decisions.

---

**Session 6 (Phase 6 — manual overrides)**
Scope decision made without asking further: overrides cover gain and
pan only, not EQ moves. EQ cuts are already conditional (only appear
when `detectMasking()` finds a real conflict) and building override UI
for a variable-length per-band list is a bigger surface than a slider —
revisit if gain/pan overrides prove insufficient in practice.

- `src/audio/track.js` — added `track.overrides = { gainDb: null, pan:
  null }`. `null` means "use the automatic value."
- `src/decision/overrides.js` — `setGainOverride`/`clearGainOverride`/
  `setPanOverride`/`clearPanOverride`, plus `applyOverrides(track,
  targets)` which layers overrides on top of freshly-computed automatic
  targets and appends a reason string noting what the automatic value
  would have been.
- `src/decision/index.js` — calls `applyOverrides()` as the final step
  after masking/levels/panning, so overrides always win and are always
  visible in the reasons list.
- `src/processing/trackChain.js` — exported `dbToLinear()` (was
  private) so UI code can convert slider dB values to linear gain for
  live parameter updates without duplicating the formula.
- `main.js` — added gain and pan sliders per track row. Important UX
  detail: slider `input` events (fire continuously while dragging)
  update the live audio param directly and refresh only a text label —
  they do NOT trigger `renderTracks()`, because replacing the slider's
  own DOM node mid-drag breaks the drag interaction in most browsers.
  Only the `change` event (fires once, on release) commits the
  override and does a full re-render. Reset buttons (↺) per parameter
  clear the override and revert to automatic, updating any live-playing
  chain immediately.

Verified in Node with mocked tracks: automatic gain computed first,
then overridden to a specific value, confirmed the override survives a
second full decision-engine run (simulating e.g. a lead-track change
or new track loading), confirmed clearing the override correctly
reverts to the automatic value while an independently-set pan override
remains untouched. All per-parameter independence checks passed.

**Still not tested in a real browser** — this note has now carried
across three sessions (4, 5, 6) and is overdue. The slider input/change
split in particular is the kind of thing that's easy to get subtly
wrong in a way no amount of Node-side testing catches (does dragging
actually feel smooth, does the live audio update actually sound
instant, does anything visually jank on reset). Please prioritize this
before Phase 7.

Also worth a fresh look at whether `main.js` should finally be split —
see the updated note at the top of that file. Not done this session;
flagging so it doesn't get forgotten.

Next: Phase 7+ is intentionally undefined. Candidates mentioned in
AI_BUILD_GUIDE.md: genre presets, export/render to a single mixed
file, save/load a session, visual EQ curve editing. Don't pick one
without checking in on priority first — these are meaningfully
different in scope (export is a solid, contained chunk of work;
session save/load touches persistence and is a bigger decision; genre
presets require deciding what "genre" even changes in the rule engine).
Recommend: real-browser test pass first, then decide Phase 7 based on
what that testing reveals is actually missing, rather than working
through the candidate list in order.

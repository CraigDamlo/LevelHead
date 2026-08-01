# AI build guide

This project is built a few phases at a time across separate chat sessions,
often stopping mid-phase when a context/token limit is hit. This file exists
so a new session (any AI, or a human) can pick up work without re-deriving
the plan.

## How to start a session

1. Read `PROGRESS.md` first. It has a checklist and a session log with notes
   from the last stopping point.
2. Work on the next unchecked item in the current phase. Don't jump ahead to
   a later phase unless the person explicitly asks.
3. Keep changes scoped to one phase at a time — don't refactor earlier
   phases unless something is actually broken.
4. Before ending the session (context running low, or a natural stopping
   point), update `PROGRESS.md`: check off what's done, and add a short
   note to the session log — what's half-finished, what decision is
   pending, what to do next. Assume the next session has zero memory of
   this conversation beyond that file.

## Conventions

- Vanilla JS, ES modules (`type="module"`), no bundler, no framework, no
  build step. Files should run as static files served directly.
- No external dependencies unless there's a strong reason — this should
  stay self-hostable and simple to audit.
- One concern per file under `src/`. Don't let `main.js` grow into a dumping
  ground — it should mostly just wire modules together.
- All bash commands for setup/testing should be written to a `.sh` file and
  run explicitly (`bash scriptname.sh`) rather than run inline — this repo's
  owner uses fish shell, and inline multi-line bash tends to break there.
- Prefer `OfflineAudioContext` for analysis passes over live/real-time
  analysis unless a phase specifically calls for live metering.
- Keep the rule-based decision engine inspectable: each automatic decision
  (a gain change, an EQ cut, a pan position) should carry a reason string
  and the numbers that drove it, so the UI can show "why" and so it's
  debuggable without guessing.

## Phases

Each phase should be small enough to finish in one session under normal
circumstances. If a phase is running long, stop at a clean sub-point and
log it rather than pushing through.

### Phase 0 — Scaffold (done by this initial setup)
- [x] Directory structure, README, this guide, progress tracker
- [x] `index.html` skeleton, `package.json`, `.gitignore`

### Phase 1 — Audio loading
Goal: load one or more audio files (drag/drop or file picker), decode them
into `AudioBuffer`s, and hold them as a simple in-memory track list.
- Files: `src/audio/loader.js`, `src/audio/track.js`
- Definition of done: can load 2+ files, see them listed with name and
  duration, buffers are decoded and accessible from `main.js`.

### Phase 2 — Analysis pipeline
Goal: for each loaded track, compute:
  - short-term loudness (RMS or approximate LUFS, ~400ms windows)
  - spectral energy per band (FFT via `OfflineAudioContext` + `AnalyserNode`,
    or a manual FFT pass — decide and document the choice)
  - basic transient/onset detection (simple peak-picking is fine for v1)
- Files: `src/analysis/loudness.js`, `src/analysis/spectral.js`,
  `src/analysis/transients.js`, `src/analysis/index.js` (orchestrates and
  returns one analysis object per track)
- Definition of done: given a loaded track, produces a plain-object report
  with loudness curve, per-band energy, and detected onsets — logged to
  console is fine before the UI exists.

### Phase 3 — Decision engine
Goal: turn analysis reports into a set of per-track targets: gain offset,
EQ moves (band + cut/boost amount), pan position.
- Files: `src/decision/masking.js` (frequency conflict detection),
  `src/decision/levels.js` (loudness balancing against a reference track),
  `src/decision/panning.js`, `src/decision/index.js` (runs the rules,
  returns a targets object per track with reasons attached)
- Definition of done: given analysis reports for 2+ tracks, produces target
  objects that make sense on manual inspection (e.g. two tracks masking in
  the same band actually get opposing EQ moves).

### Phase 4 — Processing chain
Goal: build the actual Web Audio node graph per track (gain → EQ bands →
panner → shared bus compressor) and apply the decision engine's targets to
real audio parameters.
- Files: `src/processing/trackChain.js`, `src/processing/bus.js`
- Definition of done: playing all loaded tracks together produces an
  audibly different (better-balanced) result than playing them at unity
  gain with no processing.

### Phase 5 — UI: meters and playback
Goal: basic transport (play/pause/stop), per-track level meters, and a
simple readout of what the decision engine chose per track.
- Files: `src/ui/transport.js`, `src/ui/meters.js`, `src/ui/index.js`
- Definition of done: can play the mix, see live-ish meters, see each
  track's applied gain/EQ/pan and why (from the reason strings).

### Phase 6 — UI: manual overrides
Goal: let the user drag a fader or EQ point to override an automatic
decision without the engine fighting them on the next pass.
- Files: extend `src/ui/`, add `src/decision/overrides.js` (tracks which
  parameters are user-locked vs. automatic)
- Definition of done: overriding one track's gain doesn't get silently
  reset, and re-running analysis (e.g. after loading a new track) respects
  existing overrides.

### Phase 7+ — Polish / TBD
Left open — likely candidates: preset genre profiles, export/render to a
single mixed file, saving/loading a session, visual EQ curve editing. Don't
plan these in detail until Phases 1–6 are solid; add sub-phases here as
they're decided on.

## Non-goals (for now)

- No ML/learned models — this is deliberately Tier 1 (rule-based). Don't
  add a training pipeline or pull in a model without an explicit decision
  to expand scope.
- No real-time collaborative mixing, no cloud storage, no accounts.
- No mobile-specific UI work until desktop is functional.

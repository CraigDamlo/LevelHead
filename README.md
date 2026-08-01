# LevelHead

[Repo](https://github.com/CraigDamlo/LevelHead) · [Live demo](https://craigdamlo.github.io/LevelHead/)

A browser-based automatic mixing tool. Load multitrack audio, and it analyzes
level, spectral overlap, and transients per track, then applies rule-based
gain, EQ, panning, and compression to produce a balanced mix — with manual
override controls in the UI.

Runs entirely client-side on the Web Audio API. No build step, no backend.
Self-hostable as static files, and deployable directly as a GitHub Pages
site since there's no build step to run.

## Status

This project is built incrementally across sessions. See
[`AI_BUILD_GUIDE.md`](./AI_BUILD_GUIDE.md) for the phased plan and
[`PROGRESS.md`](./PROGRESS.md) for what's done and what's next.

## Stack

- Vanilla JS, ES modules, no framework, no bundler
- Web Audio API (`AnalyserNode`, `BiquadFilterNode`, `GainNode`,
  `StereoPannerNode`, `DynamicsCompressorNode`, `OfflineAudioContext` for
  offline analysis passes)
- SVG for any visualization (meters, EQ curves)

## Running locally

No install needed for the app itself. Serve the directory statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000`.

## Deployment

This is a static site with no build step, so GitHub Pages serves it
directly from the repo. Settings → Pages → deploy from `main`, root
folder. All script/module paths are relative (`./src/...`), which is
required for Pages since the site lives at a subpath
(`/LevelHead/`), not the domain root — keep it that way as the project
grows.

## Project layout

```
levelhead/
├── index.html              entry point
├── src/
│   ├── main.js              wires everything together
│   ├── audio/                loading, decoding, track management
│   ├── analysis/              loudness, spectral, transient analysis
│   ├── decision/               rule engine — turns analysis into targets
│   ├── processing/              Web Audio node chain per track
│   └── ui/                      meters, EQ curve display, override controls
├── docs/
│   └── (design notes as they accumulate)
├── AI_BUILD_GUIDE.md        phased build plan for AI-assisted sessions
└── PROGRESS.md               checklist + session log, read this first
```

## Design principles

- Analysis runs offline (`OfflineAudioContext`) wherever possible — easier to
  debug than live analysis, and mixing decisions don't need to be real-time.
- Rule-based decision engine (Tier 1 auto-mixing), not ML. Keep it
  inspectable: every automatic decision should be traceable to a specific
  rule and specific analysis numbers.
- Every automatic decision is an editable target, not a baked-in effect —
  the UI shows what the engine chose and lets you override it per track.

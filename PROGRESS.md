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
- [ ] Phase 4 — Processing chain
- [ ] Phase 5 — UI: meters and playback
- [ ] Phase 6 — UI: manual overrides
- [ ] Phase 7+ — Polish (not yet planned in detail)

## Current focus

Phase 7b/7c — still open: save/load session, and genre presets, were
the other two Phase 7 candidates discussed but not chosen yet. Real-
browser testing (carried over from sessions 4/5/6) is still the single
most overdue item — please do this before anything else.

## Session log

Newest entry at the top. Keep entries short: what changed, what's
half-done, what to do next, any open decisions.

---

**Session 7 (Phase 7a — export to WAV)**
Of the three Phase 7 candidates (export, save/load, genre presets),
export was picked first. Implemented:

- `src/processing/render.js` — `renderMix(tracks)`, offline rendering
  via `OfflineAudioContext`. Deliberately reuses `buildTrackChain()`
  and `createBus()` unchanged from live playback (both already accepted
  a generic Web Audio context, so this needed zero changes to either
  file) — export is guaranteed to sound identical to "Play mix" because
  it's the same code path, not a parallel implementation that could
  drift out of sync. Output is fixed at 2 channels, sample rate matches
  the shared AudioContext's rate, length is sized to the longest track.
  Throws a clear error if called with no analyzed/decided tracks.
- `src/processing/wavEncoder.js` — `audioBufferToWav()`, hand-rolled
  16-bit PCM WAV encoding (44-byte header + interleaved samples). No
  external dependency — chose 16-bit over 32-bit float for maximum
  compatibility with whatever the file gets opened in afterward.
- `main.js` — added an Export button (green, pushed to the right of the
  transport cluster via `margin-left: auto`). Shows "Rendering…" and
  disables itself during render; triggers a browser download via a
  temporary anchor tag + `URL.createObjectURL`. Export runs independent
  of live playback state — you can export while the mix is playing,
  since `renderMix()` builds its own isolated OfflineAudioContext and
  chains rather than touching anything the live transport is using.

Verified in Node: WAV encoder checked byte-for-byte against a small
hand-computed buffer (RIFF/WAVE/fmt/data tags, channel count, sample
rate, bit depth, and sample values all correct within 16-bit rounding).
`renderMix()` checked with a mocked `OfflineAudioContext` — confirmed
it throws with no playable tracks, and that it constructs the offline
context with the right channel count, sample rate, and length (based
on the longest track's duration). Did not, and cannot from here, verify
that an actual exported WAV file opens correctly in a real player —
that's real-browser-territory, same carried-over caveat as before.

Next: pick between the two remaining Phase 7 candidates (save/load
session, genre presets) — or, better, get the overdue real-browser
testing pass done first, since it might reshape what's actually worth
building next (e.g. if export sounds wrong, that's a processing-chain
bug to fix before adding more features on top of it).

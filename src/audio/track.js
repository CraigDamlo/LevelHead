// A single loaded track: the decoded audio plus metadata. Kept as a plain
// class with no Web Audio node references — those get created later in
// src/processing when a track is actually wired into the graph. Keeping
// this dumb makes it easy to re-analyze or re-process a track without
// worrying about node lifecycle.

let nextId = 1;

export class Track {
  /**
   * @param {string} name - display name, usually the filename
   * @param {AudioBuffer} audioBuffer - decoded audio data
   */
  constructor(name, audioBuffer) {
    this.id = nextId++;
    this.name = name;
    this.audioBuffer = audioBuffer;
    this.duration = audioBuffer.duration;
    this.numberOfChannels = audioBuffer.numberOfChannels;
    this.sampleRate = audioBuffer.sampleRate;

    // Populated by later phases. Left null here so it's obvious what
    // hasn't run yet when inspecting a track in the console.
    this.analysis = null;   // Phase 2
    this.targets = null;    // Phase 3 (gain/EQ/pan targets + reasons)

    // Phase 3: user-marked lead/reference track. Only one track should
    // have this true at a time — enforced by the UI layer, not here.
    // If no track is marked, the decision engine falls back to the
    // loudest track (see src/decision/reference.js).
    this.isLead = false;

    // Phase 6: manual overrides. null means "use the automatic value";
    // a number means "user has locked this parameter". Scoped to gain
    // and pan only — EQ-move overrides are deferred (see
    // src/decision/overrides.js for why). Applied on top of the
    // decision engine's computed targets each time it runs, so
    // re-analysis or a lead-track change doesn't silently discard a
    // manual adjustment.
    this.overrides = { gainDb: null, pan: null };
  }
}

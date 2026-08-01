// Loading and decoding audio files into Track objects. One shared
// AudioContext for the whole app — created lazily on first use since
// browsers require a user gesture before an AudioContext can run.

import { Track } from './track.js';

let sharedContext = null;

/**
 * Returns the shared AudioContext, creating it on first call.
 * Must be called from within a user-gesture handler (e.g. a click or
 * file-input change) the first time, or the context will start suspended.
 */
export function getAudioContext() {
  if (!sharedContext) {
    sharedContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedContext.state === 'suspended') {
    sharedContext.resume();
  }
  return sharedContext;
}

/**
 * Decodes a single File into a Track. Rejects with a descriptive error
 * if the file isn't decodable audio (wrong type, corrupt, unsupported
 * codec) rather than letting the raw DOMException bubble up.
 * @param {File} file
 * @returns {Promise<Track>}
 */
export async function loadFile(file) {
  const context = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();

  let audioBuffer;
  try {
    audioBuffer = await context.decodeAudioData(arrayBuffer);
  } catch (err) {
    throw new Error(`Couldn't decode "${file.name}" as audio: ${err.message || err}`);
  }

  return new Track(file.name, audioBuffer);
}

/**
 * Decodes multiple files in parallel. Individual failures don't block
 * the others — returns { tracks, errors } so the caller can show
 * partial success (e.g. 3 of 4 files loaded, one had a bad codec).
 * @param {FileList|File[]} files
 * @returns {Promise<{tracks: Track[], errors: {file: File, message: string}[]}>}
 */
export async function loadFiles(files) {
  const results = await Promise.allSettled(
    Array.from(files).map((file) => loadFile(file))
  );

  const tracks = [];
  const errors = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      tracks.push(result.value);
    } else {
      errors.push({ file: files[i], message: result.reason.message });
    }
  });

  return { tracks, errors };
}

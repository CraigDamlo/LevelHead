// Genre presets: named parameter sets for the decision engine's rules.
// Each preset tunes the same three rules (masking, levels, panning)
// differently — this file doesn't add new *behavior*, it parametrizes
// existing, already-tested behavior (see the "params" argument each of
// detectMasking/balanceLevels/assignPanning now accepts). What "genre"
// means here is deliberately narrow: how aggressively to correct
// masking conflicts, how much headroom to leave between the lead and
// everything else, and how wide to spread the stereo field. It does
// NOT change which bands get analyzed, add new rules, or touch the
// analysis pipeline (Phase 2) at all — same analysis, differently
// interpreted.
//
// Values below were picked by reasoning about typical arrangement
// density and mixing convention per genre, not measured against real
// reference mixes — treat these as a reasonable starting point to tune
// by ear, not settled science. If a preset sounds wrong on real
// material, adjust its numbers here; the rule logic itself (masking.js/
// levels.js/panning.js) shouldn't need to change for that.

export const PRESETS = {
  default: {
    label: 'Default',
    description: 'Balanced starting point, no genre assumptions.',
    maskingSignificantShare: 0.15,
    maskingCutDb: -3,
    levelTargetOffsetDb: -3,
    levelMaxAdjustDb: 6,
    panBassDominantThreshold: 0.35,
    panSpreadWidth: 1.0,
  },
  band: {
    label: 'Rock / Band',
    description:
      'Guitars and other mid-range instruments often compete for the same space — corrects more assertively, full stereo spread.',
    maskingSignificantShare: 0.12,
    maskingCutDb: -4,
    levelTargetOffsetDb: -4,
    levelMaxAdjustDb: 8,
    panBassDominantThreshold: 0.35,
    panSpreadWidth: 1.0,
  },
  electronic: {
    label: 'Electronic',
    description:
      'Dense, layered mixes with a strong low end that should stay anchored center; elements sit closer in level to each other than a live band would.',
    maskingSignificantShare: 0.18,
    maskingCutDb: -3,
    levelTargetOffsetDb: -2,
    levelMaxAdjustDb: 6,
    panBassDominantThreshold: 0.45,
    panSpreadWidth: 1.0,
  },
  acoustic: {
    label: 'Acoustic / Folk',
    description:
      'Sparser arrangements — gentler corrections, more room for a lead to sit clearly above the rest, slightly narrower stereo image.',
    maskingSignificantShare: 0.2,
    maskingCutDb: -2,
    levelTargetOffsetDb: -5,
    levelMaxAdjustDb: 5,
    panBassDominantThreshold: 0.3,
    panSpreadWidth: 0.8,
  },
  ambient: {
    label: 'Ambient / Drone',
    description:
      'Long sustained layers are meant to overlap and blend, not compete — much gentler masking correction, elements sit close together in level rather than around one dominant lead, full wide stereo field for an immersive image.',
    maskingSignificantShare: 0.3,
    maskingCutDb: -1.5,
    levelTargetOffsetDb: -1.5,
    levelMaxAdjustDb: 5,
    panBassDominantThreshold: 0.4,
    panSpreadWidth: 1.0,
  },
  podcast: {
    label: 'Podcast / Spoken word',
    description:
      'Every voice should be equally intelligible — minimal masking correction (little spectral overlap expected between voices), tight level matching, no stereo spread.',
    maskingSignificantShare: 0.25,
    maskingCutDb: -2,
    levelTargetOffsetDb: -0.5,
    levelMaxAdjustDb: 10,
    panBassDominantThreshold: 0.35,
    panSpreadWidth: 0, // keep every voice centered — no stereo spread
  },
};

export const DEFAULT_PRESET_ID = 'default';

/**
 * @param {string} id
 * @returns {typeof PRESETS[keyof typeof PRESETS]}
 */
export function getPreset(id) {
  return PRESETS[id] || PRESETS[DEFAULT_PRESET_ID];
}

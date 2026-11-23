'use strict';

const AIFeatureTypes = {
  TRANSLATION: 'translation',
  // Generic integration used by the LePatron Skills IA module.
  // A single 'skill' AIFeatureConfig per Group powers all skill invocations.
  // The legacy 'translation' featureType will eventually be migrated to a
  // dedicated skill (translation.text) — kept separate for now.
  SKILL: 'skill',
  // Text generation in the editor (subject, preheader…). A client feature with
  // its own engine, so a group can open it without opening every skill.
  TEXT_GENERATION: 'text_generation',
};

const AIFeatureTypeValues = Object.values(AIFeatureTypes);

// The features that run skills, so need an engine that writes text: a
// translation-only integration (DeepL) would fail every invocation.
const TEXT_FEATURE_TYPES = Object.freeze([
  AIFeatureTypes.SKILL,
  AIFeatureTypes.TEXT_GENERATION,
]);

module.exports = AIFeatureTypes;
module.exports.AIFeatureTypeValues = AIFeatureTypeValues;
module.exports.TEXT_FEATURE_TYPES = TEXT_FEATURE_TYPES;

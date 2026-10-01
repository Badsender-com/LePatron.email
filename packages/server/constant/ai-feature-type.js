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

module.exports = AIFeatureTypes;
module.exports.AIFeatureTypeValues = AIFeatureTypeValues;

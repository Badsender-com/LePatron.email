'use strict';

const AIFeatureTypes = {
  TRANSLATION: 'translation',
  // Generic integration used by the LePatron Skills IA module.
  // A single 'skill' AIFeatureConfig per Group powers all skill invocations.
  // The legacy 'translation' featureType will eventually be migrated to a
  // dedicated skill (translation.text) — kept separate for now.
  SKILL: 'skill',
  // Future features
  // TEXT_GENERATION: 'text_generation',
  // TEXT_IMPROVEMENT: 'text_improvement',
  // QUALITY_CHECK: 'quality_check',
  // SUBJECT_LINE: 'subject_line',
};

const AIFeatureTypeValues = Object.values(AIFeatureTypes);

module.exports = AIFeatureTypes;
module.exports.AIFeatureTypeValues = AIFeatureTypeValues;

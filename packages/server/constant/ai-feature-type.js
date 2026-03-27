'use strict';

const AIFeatureTypes = {
  TRANSLATION: 'translation',
  // Future features
  // TEXT_GENERATION: 'text_generation',
  // TEXT_IMPROVEMENT: 'text_improvement',
  // QUALITY_CHECK: 'quality_check',
  // SUBJECT_LINE: 'subject_line',
};

const AIFeatureTypeValues = Object.values(AIFeatureTypes);

module.exports = AIFeatureTypes;
module.exports.AIFeatureTypeValues = AIFeatureTypeValues;

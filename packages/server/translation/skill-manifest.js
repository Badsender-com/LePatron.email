'use strict';

/**
 * LePatron Skills IA — manifest declaring the skills/expertise consumed by
 * the translation feature.
 *
 * v1 squelette: the legacy translation pipeline still calls the LLM directly
 * (no skill invocation). The manifest is kept ready so when translation is
 * re-implemented as the `translation.text` skill, this file becomes the single
 * declaration consumed by `scripts/check-skill-usage.js`.
 */
module.exports = {
  featureType: 'translation',
  description: 'Email translation (legacy pipeline — not yet a skill)',
  usedSkills: [],
  usedExpertise: [],
};

'use strict';

/**
 * LePatron Skills IA — the skills and expertise filters of text generation
 * (subject and preheader in the editor, ADR 0003). Read by
 * scripts/check-skill-usage.js and by the activation-impact alert.
 */
module.exports = {
  featureType: 'text_generation',
  description: 'Subject and preheader proposals in the editor',
  usedSkills: [
    { skillId: 'redaction.objet' },
    { skillId: 'redaction.pre-header' },
  ],
  usedExpertise: [],
  expertiseFilters: [
    { scope: ['subject'], categories: ['redaction', 'deliverability'] },
    { scope: ['preheader'], categories: ['redaction', 'deliverability'] },
  ],
};

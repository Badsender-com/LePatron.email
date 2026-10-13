'use strict';

/**
 * LePatron Skills IA — the skills and expertise filters of text generation
 * (subject and preheader in the editor, ADR 0003; spelling correction, ADR
 * 0005). Read by scripts/check-skill-usage.js and by the activation-impact
 * alert.
 */
module.exports = {
  featureType: 'text_generation',
  description:
    'Subject and preheader proposals, and spelling corrections, in the editor',
  usedSkills: [
    { skillId: 'redaction.objet' },
    { skillId: 'redaction.pre-header' },
    { skillId: 'redaction.correction' },
  ],
  usedExpertise: [],
  expertiseFilters: [
    { scope: ['subject'], categories: ['redaction', 'deliverability'] },
    { scope: ['preheader'], categories: ['redaction', 'deliverability'] },
    // None written today: a house rule (a brand never to correct) can be
    // added in the admin, without code. The transversal writing principles
    // are left out: they would push the skill towards rewriting.
    {
      scope: ['correction'],
      categories: ['redaction'],
      excludeTransversal: true,
    },
  ],
};

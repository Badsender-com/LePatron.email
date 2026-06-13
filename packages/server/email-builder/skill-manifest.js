'use strict';

/**
 * Skill-usage manifest for the email-builder textgen feature (POC).
 * `yarn check-skills` validates that every skillInvocation.invoke() call site
 * references a skill declared here, and that the declared skills/expertise
 * exist and are ACTIVE in the database.
 *
 * featureType 'poc.textgen' is a reserved non-productive type (excluded from
 * the Invocations analytics, like 'playground' and 'admin-test') — see
 * docs/AI_SKILL_AUTHORING.md.
 */
module.exports = {
  featureType: 'poc.textgen',
  description:
    'POC — génération IA du contenu d\'un bloc dans l\'éditeur Mosaico',
  usedSkills: [{ skillId: 'redaction.block.promo' }],
  usedExpertise: [
    { expertiseId: 'redaction.cta.principes-generaux' },
    { expertiseId: 'redaction.cta.promo-specifics' },
    { expertiseId: 'redaction.brand-voice-defaults' },
  ],
  // The findApplicable filter this feature issues. Feeds the activation-impact
  // alert: activating a redaction/cta expertise surfaces "loaded by POC textgen".
  expertiseFilters: [
    { scope: 'cta', categories: ['redaction'], emailType: 'promo' },
  ],
};

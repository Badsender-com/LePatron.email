'use strict';

// Which features use a skill (ADR 0019), from the features' own manifests. A
// manifest names its skills by their id, or as objects carrying it (the text
// generation's: `{ skillId: 'redaction.objet' }`): both count.

const MANIFESTS = [
  {
    featureType: 'text_generation',
    description: 'Subject and preheader proposals',
    usedSkills: [
      { skillId: 'redaction.objet' },
      { skillId: 'redaction.pre-header' },
    ],
    usedExpertise: [],
    expertiseFilters: [],
  },
  {
    featureType: 'translation',
    description: 'Translation',
    usedSkills: ['translation.text'],
    usedExpertise: [],
    expertiseFilters: [],
  },
];

jest.mock(
  '../../../packages/server/ai-skill/services/manifest-registry.js',
  () => ({
    ...jest.requireActual(
      '../../../packages/server/ai-skill/services/manifest-registry.js'
    ),
    listManifests: () => MANIFESTS,
  })
);

const {
  manifestsUsing,
  usedSkillIds,
} = require('../../../packages/server/ai-skill/services/feature-use.js');

describe('the features that use a skill', () => {
  it.each([
    ['as an object carrying its id', 'redaction.objet', 'text_generation'],
    ['by its id', 'translation.text', 'translation'],
  ])('counts a skill a feature names %s', (_case, skillId, featureType) => {
    const features = manifestsUsing('skill', { skillId, status: 'ACTIVE' });

    expect(features.map((m) => m.featureType)).toEqual([featureType]);
  });

  it('gives the ids of the skills a feature names, whatever their form', () => {
    expect(MANIFESTS.flatMap(usedSkillIds)).toEqual([
      'redaction.objet',
      'redaction.pre-header',
      'translation.text',
    ]);
  });
});

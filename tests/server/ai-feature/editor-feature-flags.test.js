'use strict';

/**
 * Acceptance tests of text generation (epic #1163): what the editor is told.
 *
 * The editor shows the text generation button only when the group can use it:
 * the feature on, with an active integration, and its two skills active and
 * open to the group (ADR 0013). It does not depend on the email metadata —
 * without them, the proposal is offered to copy.
 */

jest.mock('../../../packages/server/common/models.common', () => ({
  AIFeatureConfigs: { findOne: jest.fn() },
  Integrations: { findOne: jest.fn() },
  Groups: { findById: jest.fn() },
  LePatronSkills: { find: jest.fn() },
}));
jest.mock('../../../packages/server/group/group.service', () => ({
  findById: jest.fn(),
}));

const {
  AIFeatureConfigs,
  Groups,
  LePatronSkills,
} = require('../../../packages/server/common/models.common');
const aiFeatureService = require('../../../packages/server/ai-feature/ai-feature.service');

const GROUP_ID = '6500000000000000000000bb';

function configWith(features) {
  AIFeatureConfigs.findOne.mockReturnValue({
    populate: jest.fn().mockResolvedValue(features ? { features } : null),
  });
}

// Every skill text generation calls, as its manifest declares them.
const TEXT_GENERATION_SKILLS = require('../../../packages/server/text-generation/skill-manifest.js').usedSkills.map(
  (used) => used.skillId
);

// The skills a query finds: those its audience filter lets through.
function skills(...docs) {
  LePatronSkills.find.mockImplementation((query) => ({
    lean: jest
      .fn()
      .mockResolvedValue(
        docs.filter((doc) => !query.audience || doc.audience === query.audience)
      ),
  }));
}
const openSkill = (skillId) => ({ skillId, audience: 'all' });
const platformSkill = (skillId) => ({ skillId, audience: 'platform' });

function companyIs(group) {
  Groups.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(group) }),
  });
}

const active = { _id: 'i1', isActive: true };
const inactive = { _id: 'i2', isActive: false };

describe('editor data: text generation flag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    companyIs({ isPlatform: false });
    skills(...TEXT_GENERATION_SKILLS.map(openSkill));
  });

  it('is on when text generation is active with an active integration', async () => {
    configWith([
      { featureType: 'text_generation', isActive: true, integration: active },
    ]);
    await expect(
      aiFeatureService.getEditorFeatureFlags({ groupId: GROUP_ID })
    ).resolves.toEqual({
      hasTranslationFeature: false,
      hasTextGenerationFeature: true,
    });
  });

  it.each([
    [
      'the feature is off',
      { featureType: 'text_generation', isActive: false, integration: active },
    ],
    [
      'no integration is chosen',
      { featureType: 'text_generation', isActive: true, integration: null },
    ],
    [
      'the integration is off',
      { featureType: 'text_generation', isActive: true, integration: inactive },
    ],
  ])('is off when %s', async (_label, feature) => {
    configWith([feature]);
    const flags = await aiFeatureService.getEditorFeatureFlags({
      groupId: GROUP_ID,
    });
    expect(flags.hasTextGenerationFeature).toBe(false);
  });

  it('is off for a group that never configured its AI features', async () => {
    configWith(null);
    await expect(
      aiFeatureService.getEditorFeatureFlags({ groupId: GROUP_ID })
    ).resolves.toEqual({
      hasTranslationFeature: false,
      hasTextGenerationFeature: false,
    });
  });

  it('does not follow the generic skill engine', async () => {
    configWith([{ featureType: 'skill', isActive: true, integration: active }]);
    const flags = await aiFeatureService.getEditorFeatureFlags({
      groupId: GROUP_ID,
    });
    expect(flags.hasTextGenerationFeature).toBe(false);
  });

  it('reports translation and text generation independently', async () => {
    configWith([
      { featureType: 'translation', isActive: true, integration: active },
      { featureType: 'text_generation', isActive: false, integration: active },
    ]);
    await expect(
      aiFeatureService.getEditorFeatureFlags({ groupId: GROUP_ID })
    ).resolves.toEqual({
      hasTranslationFeature: true,
      hasTextGenerationFeature: false,
    });
  });

  describe('the skills it calls', () => {
    const on = [
      { featureType: 'text_generation', isActive: true, integration: active },
    ];

    it('is off for a client company when a skill is kept to the platform company', async () => {
      configWith(on);
      skills(
        openSkill('redaction.objet'),
        platformSkill('redaction.pre-header')
      );
      const flags = await aiFeatureService.getEditorFeatureFlags({
        groupId: GROUP_ID,
      });
      expect(flags.hasTextGenerationFeature).toBe(false);
    });

    it('is on for the platform company, which uses every audience', async () => {
      configWith(on);
      companyIs({ isPlatform: true });
      skills(...TEXT_GENERATION_SKILLS.map(platformSkill));
      const flags = await aiFeatureService.getEditorFeatureFlags({
        groupId: GROUP_ID,
      });
      expect(flags.hasTextGenerationFeature).toBe(true);
    });

    it('is off when a skill is not active in the environment', async () => {
      configWith(on);
      skills(openSkill('redaction.objet'));
      const flags = await aiFeatureService.getEditorFeatureFlags({
        groupId: GROUP_ID,
      });
      expect(flags.hasTextGenerationFeature).toBe(false);
    });

    it('reads the active skills open to the company in one projected query', async () => {
      configWith(on);
      await aiFeatureService.getEditorFeatureFlags({ groupId: GROUP_ID });
      expect(LePatronSkills.find).toHaveBeenCalledTimes(1);
      expect(LePatronSkills.find).toHaveBeenCalledWith(
        {
          skillId: { $in: TEXT_GENERATION_SKILLS },
          status: 'ACTIVE',
          audience: 'all',
        },
        { skillId: 1 }
      );
    });

    it('uses the company the caller already read', async () => {
      configWith(on);
      skills(...TEXT_GENERATION_SKILLS.map(platformSkill));
      const flags = await aiFeatureService.getEditorFeatureFlags({
        groupId: GROUP_ID,
        group: { isPlatform: true },
      });
      expect(Groups.findById).not.toHaveBeenCalled();
      expect(flags.hasTextGenerationFeature).toBe(true);
    });

    it('reads no skill when the feature is off', async () => {
      configWith([
        {
          featureType: 'text_generation',
          isActive: false,
          integration: active,
        },
      ]);
      await aiFeatureService.getEditorFeatureFlags({ groupId: GROUP_ID });
      expect(LePatronSkills.find).not.toHaveBeenCalled();
    });
  });
});

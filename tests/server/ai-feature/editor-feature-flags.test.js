'use strict';

/**
 * Acceptance tests of text generation (epic #1163): what the editor is told.
 *
 * The editor shows the text generation button only when the group can use it:
 * the feature on, with an active integration. It does not depend on the email
 * metadata — without them, the proposal is offered to copy.
 */

jest.mock('../../../packages/server/common/models.common', () => ({
  AIFeatureConfigs: { findOne: jest.fn() },
  Integrations: { findOne: jest.fn() },
}));
jest.mock('../../../packages/server/group/group.service', () => ({
  findById: jest.fn(),
}));

const {
  AIFeatureConfigs,
} = require('../../../packages/server/common/models.common');
const aiFeatureService = require('../../../packages/server/ai-feature/ai-feature.service');

const GROUP_ID = '6500000000000000000000bb';

function configWith(features) {
  AIFeatureConfigs.findOne.mockReturnValue({
    populate: jest.fn().mockResolvedValue(features ? { features } : null),
  });
}

const active = { _id: 'i1', isActive: true };
const inactive = { _id: 'i2', isActive: false };

// Turned on by #1166 (generate and apply a subject from the editor)
describe.skip('editor data: text generation flag', () => {
  beforeEach(() => jest.clearAllMocks());

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
});

'use strict';

jest.mock('../../../packages/server/ai-feature/ai-feature.service.js', () => ({
  getActiveFeatureWithIntegration: jest.fn(),
}));
jest.mock(
  '../../../packages/server/ai-skill/repositories/expertise.repository.js',
  () => ({ findApplicable: jest.fn() })
);
jest.mock(
  '../../../packages/server/ai-skill/services/skill-invocation.service.js',
  () => ({ invoke: jest.fn() })
);

const aiFeatureService = require('../../../packages/server/ai-feature/ai-feature.service.js');
const expertiseRepo = require('../../../packages/server/ai-skill/repositories/expertise.repository.js');
const skillInvocation = require('../../../packages/server/ai-skill/services/skill-invocation.service.js');
const {
  generateBlockText,
} = require('../../../packages/server/email-builder/textgen.service.js');

const CONTENT = [
  { path: 'titleText', value: 'Old title' },
  { path: 'longText', value: '<p>Old body</p>' },
  { path: 'buttonLink.text', value: 'BUTTON' },
];

function wire({ output } = {}) {
  aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue({
    feature: { isActive: true },
    integration: { isActive: true },
  });
  expertiseRepo.findApplicable.mockResolvedValue([
    {
      expertiseId: 'redaction.cta.principes-generaux',
      title: 'CTA',
      body: 'Règles…',
      examplesGood: [],
      examplesBad: [],
      versionMajor: 1,
      versionMinor: 0,
      sections: [],
    },
  ]);
  skillInvocation.invoke.mockResolvedValue({
    output:
      output || CONTENT.map((e) => ({ path: e.path, value: `NEW ${e.value}` })),
  });
}

beforeEach(() => jest.clearAllMocks());

describe('textgen.service.generateBlockText', () => {
  it('rejects when the group has no active Skills engine', async () => {
    aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue(null);
    await expect(
      generateBlockText({
        groupId: 'g',
        instruction: 'x',
        currentContent: CONTENT,
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(skillInvocation.invoke).not.toHaveBeenCalled();
  });

  it('composes the input with applicable expertise and invokes with poc.textgen', async () => {
    wire();
    await generateBlockText({
      groupId: 'g',
      userId: 'u',
      instruction: 'Promo vestes',
      currentContent: CONTENT,
      fieldConstraints: 'titleText: 60 max',
    });

    const call = skillInvocation.invoke.mock.calls[0][0];
    expect(call.skillId).toBe('redaction.block.promo');
    expect(call.featureType).toBe('poc.textgen');
    expect(call.input.instruction).toBe('Promo vestes');
    expect(call.input.currentContent).toEqual(CONTENT);
    expect(call.input.fieldConstraints).toBe('titleText: 60 max');
    expect(call.input.expertise).toHaveLength(1);
    // Only the schema-declared expertise fields (no versionMajor/sections leak).
    expect(Object.keys(call.input.expertise[0]).sort()).toEqual([
      'body',
      'examplesBad',
      'examplesGood',
      'expertiseId',
      'title',
    ]);
    expect(expertiseRepo.findApplicable).toHaveBeenCalledWith({
      scope: 'cta',
      emailType: 'promo',
    });
  });

  it('filters invented paths out and reports omitted ones', async () => {
    wire({
      output: [
        { path: 'titleText', value: 'New title' },
        { path: 'inventedField', value: 'should be dropped' },
        // longText and buttonLink.text omitted by the model
      ],
    });
    const { generated, omittedPaths } = await generateBlockText({
      groupId: 'g',
      instruction: 'x',
      currentContent: CONTENT,
    });
    expect(generated).toEqual([{ path: 'titleText', value: 'New title' }]);
    expect(omittedPaths.sort()).toEqual(['buttonLink.text', 'longText']);
  });

  it('omits expertise from the input when none is applicable', async () => {
    wire();
    expertiseRepo.findApplicable.mockResolvedValue([]);
    await generateBlockText({
      groupId: 'g',
      instruction: 'x',
      currentContent: CONTENT,
    });
    expect('expertise' in skillInvocation.invoke.mock.calls[0][0].input).toBe(
      false
    );
  });
});

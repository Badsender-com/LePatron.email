'use strict';

const mongoose = require('mongoose');
const LePatronSkillSchema = require('../../../../packages/server/ai-skill/models/le-patron-skill.schema');

// Compile a fresh model under a unique name to avoid clashes with models.common.
const SkillModel =
  mongoose.models.__TestSkill ||
  mongoose.model('__TestSkill', LePatronSkillSchema);

function buildSkill(overrides = {}, versionOverrides = {}) {
  return new SkillModel({
    skillId: 'generic.text',
    title: 'Generic text',
    category: 'redaction',
    versions: [
      {
        versionMajor: 1,
        versionMinor: 0,
        // Schemas live on the version now (UX review §3).
        inputSchemaId: 'genericTextInput',
        outputSchemaId: 'genericTextOutput',
        systemPrompt: 'You are a helpful assistant.',
        skillBody: 'Reformulate the user text.',
        inputTemplate: '<user_input>{{input.prompt}}</user_input>',
        ...versionOverrides,
      },
    ],
    ...overrides,
  });
}

describe('LePatronSkill model', () => {
  it('validates a well-formed skill', async () => {
    const skill = buildSkill();
    await expect(skill.validate()).resolves.toBeUndefined();
  });

  it('rejects skillId not matching the slug regex', async () => {
    const skill = buildSkill({ skillId: 'Bad ID!' });
    await expect(skill.validate()).rejects.toThrow(/skillId/);
  });

  it('rejects unknown inputSchemaId on a published version', async () => {
    const skill = buildSkill({}, { inputSchemaId: 'nope', status: 'ACTIVE' });
    await expect(skill.validate()).rejects.toThrow(/inputSchemaId/);
  });

  it('rejects unknown outputSchemaId on a published version', async () => {
    const skill = buildSkill(
      {},
      { outputSchemaId: 'nope', status: 'ARCHIVED' }
    );
    await expect(skill.validate()).rejects.toThrow(/outputSchemaId/);
  });

  // Production writes a feature skill before the code that calls it ships
  // (ADR 0019): its draft may name a schema this code does not hold yet.
  it.each(['inputSchemaId', 'outputSchemaId'])(
    'saves a draft whose %s the code does not hold yet',
    async (field) => {
      const skill = buildSkill(
        {},
        { [field]: 'notShippedYet', status: 'DRAFT' }
      );
      await expect(skill.validate()).resolves.toBeUndefined();
    }
  );

  it('rejects {{input.*}} in systemPrompt', async () => {
    const skill = buildSkill({
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          systemPrompt: 'Hello {{input.name}}',
          skillBody: 'Do stuff',
          inputTemplate: '{{input.prompt}}',
        },
      ],
    });
    await expect(skill.validate()).rejects.toThrow(/systemPrompt/);
  });

  it('rejects {{input.*}} in skillBody', async () => {
    const skill = buildSkill({
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          systemPrompt: 'You help users',
          skillBody: 'Use {{input.prompt}}',
          inputTemplate: 'irrelevant',
        },
      ],
    });
    await expect(skill.validate()).rejects.toThrow(/skillBody/);
  });

  // Refused as a request error with a message meant to be shown, which the
  // back office and an assistant read, rather than as a failure of the server.
  it.each([
    ['systemPrompt', { systemPrompt: 'Hello {{input.name}}' }],
    ['skillBody', { skillBody: 'Use {{input.prompt}}' }],
  ])(
    'refuses {{input.*}} in %s as a request error, naming the template',
    async (_field, content) => {
      const skill = buildSkill({
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            inputTemplate: '{{input.prompt}}',
            ...content,
          },
        ],
      });
      const refusal = await skill.validate().catch((error) => error);

      expect(refusal).toMatchObject({ status: 400, expose: true });
      expect(refusal.message).toContain('inputTemplate');
    }
  );

  it('refuses an unknown schema as a request error', async () => {
    const skill = buildSkill({}, { inputSchemaId: 'nope', status: 'ACTIVE' });

    await expect(skill.validate()).rejects.toMatchObject({ status: 400 });
  });

  it('allows {{input.*}} inside inputTemplate', async () => {
    const skill = buildSkill({
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          systemPrompt: 'helper',
          skillBody: 'body',
          inputTemplate: '<x>{{input.prompt}}</x>',
        },
      ],
    });
    await expect(skill.validate()).resolves.toBeUndefined();
  });

  it('rejects invalid category', async () => {
    const skill = buildSkill({ category: 'not-a-category' });
    await expect(skill.validate()).rejects.toThrow(/category/);
  });

  it('defaults status to DRAFT', () => {
    const skill = buildSkill();
    expect(skill.status).toBe('DRAFT');
  });
});

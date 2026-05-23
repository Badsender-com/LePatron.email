'use strict';

const mongoose = require('mongoose');
const LePatronSkillSchema = require('../../../../packages/server/ai-skill/models/le-patron-skill.schema');

// Compile a fresh model under a unique name to avoid clashes with models.common.
const SkillModel =
  mongoose.models.__TestSkill ||
  mongoose.model('__TestSkill', LePatronSkillSchema);

function buildSkill(overrides = {}) {
  return new SkillModel({
    skillId: 'generic.text',
    title: 'Generic text',
    category: 'redaction',
    inputSchemaId: 'genericTextInput',
    outputSchemaId: 'genericTextOutput',
    versions: [
      {
        versionMajor: 1,
        versionMinor: 0,
        systemPrompt: 'You are a helpful assistant.',
        skillBody: 'Reformulate the user text.',
        inputTemplate: '<user_input>{{input.prompt}}</user_input>',
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

  it('rejects unknown inputSchemaId', async () => {
    const skill = buildSkill({ inputSchemaId: 'nope' });
    await expect(skill.validate()).rejects.toThrow(/inputSchemaId/);
  });

  it('rejects unknown outputSchemaId', async () => {
    const skill = buildSkill({ outputSchemaId: 'nope' });
    await expect(skill.validate()).rejects.toThrow(/outputSchemaId/);
  });

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

/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// What production answers a copy (ADR 0019), produced and read by one
// module: what production writes, a copy reads back the same, field for
// field, and a field one side adds without the other is seen here.

const { createMcpStore } = require('../../helpers/mcp-fake-models');

const store = createMcpStore();
jest.doMock(
  '../../../packages/server/common/models.common.js',
  () => store.models
);

const f = require('../../helpers/mcp-fixtures');
const format = require('../../../packages/server/ai-skill/services/skills-follow.format');

// Every field of an item set, so that the answer carries all it can.
const FULL_EXPERTISE = {
  ...f.EXPERTISES[0],
  description: 'Every field',
  isTransversal: true,
  appliesToEmailTypes: ['newsletter'],
  versions: f.EXPERTISES[0].versions.map((v) => ({
    ...v,
    changelog: 'Changed',
    releaseNotes: 'Notes',
  })),
};
const FULL_SKILL = {
  skillId: 'redaction.full',
  title: 'Every field',
  description: 'A skill with every field set',
  category: 'redaction',
  status: 'ACTIVE',
  audience: 'all',
  servedToAssistants: true,
  activeVersion: { major: 1, minor: 0 },
  versions: [
    {
      versionMajor: 1,
      versionMinor: 0,
      status: 'ACTIVE',
      nature: 'feature',
      systemPrompt: 'System',
      skillBody: 'Body',
      inputTemplate: '{{input.prompt}}',
      inputSchemaId: 'genericTextInput',
      outputSchemaId: 'genericTextOutput',
      modelHints: { temperature: 0.2, maxTokens: 300, topP: 1 },
      testCases: [
        {
          name: 'A case',
          input: { prompt: 'x' },
          expectedOutput: 'y',
          notes: 'n',
        },
      ],
      procedure: 'Steps',
      consumedExpertiseIds: ['redaction.subject-line'],
      changelog: 'First',
      releaseNotes: 'Notes',
    },
    {
      versionMajor: 1,
      versionMinor: 1,
      status: 'DRAFT',
      nature: 'task',
      procedure: 'Steps',
    },
  ],
};

const clone = (value) => JSON.parse(JSON.stringify(value));

describe("production's answer to a copy", () => {
  let answer;
  beforeAll(async () => {
    store.seed({ expertises: [FULL_EXPERTISE], skills: [FULL_SKILL] });
    answer = clone(
      await format.exportForCopies({ origin: 'prod', by: 'Staging' })
    );
  });

  it('carries its own format number', () => {
    expect(answer.followFormat).toBe(format.FOLLOW_FORMAT);
    expect(answer).not.toHaveProperty('format');
  });

  it('reads back as it was written, every field of every item', () => {
    const read = format.readProductionAnswer(clone(answer));

    expect(read.rejected).toEqual([]);
    expect(read.expertises).toEqual(answer.expertises);
    expect(read.skills).toEqual(answer.skills);
  });

  // A field added to what production writes and not to what a copy reads,
  // or the other way, shows here.
  it.each([
    ['expertise', 'expertises'],
    ['skill', 'skills'],
  ])('reads the fields of %s it writes, and no other', (kind, list) => {
    const [item] = answer[list];
    const itemKeys = Object.keys(format.ITEMS[kind].shape).sort();
    const versionKeys = Object.keys(
      format.ITEMS[kind].shape.version.unwrap().shape
    ).sort();

    expect(Object.keys(item).sort()).toEqual(itemKeys);
    expect(Object.keys(item.version).sort()).toEqual(versionKeys);
  });

  it('reads the format before its own', () => {
    expect(format.READABLE_FORMATS).toEqual([
      format.FOLLOW_FORMAT,
      format.FOLLOW_FORMAT - 1,
    ]);
    const { followFormat: _ours, ...older } = clone(answer);

    expect(
      format.readProductionAnswer({
        ...older,
        followFormat: format.FOLLOW_FORMAT - 1,
      }).expertises
    ).toHaveLength(1);
  });

  it('refuses an item carrying a field it does not know, alone', () => {
    const changed = clone(answer);
    changed.skills[0].version.newField = 'from a newer production';

    const read = format.readProductionAnswer(changed);

    expect(read.skills).toEqual([]);
    expect(read.expertises).toHaveLength(1);
    expect(read.rejected).toEqual([
      expect.objectContaining({
        kind: 'skill',
        id: 'redaction.full',
        code: 'SKILLS_FOLLOW_ITEM_UNREADABLE',
      }),
    ]);
  });

  it('refuses an item twice, the second time', () => {
    const twice = clone(answer);
    twice.expertises.push(twice.expertises[0]);

    const read = format.readProductionAnswer(twice);

    expect(read.expertises).toHaveLength(1);
    expect(read.rejected).toEqual([
      expect.objectContaining({ field: 'expertises.1.expertiseId' }),
    ]);
  });

  it('refuses an answer whose envelope it cannot read, whole', () => {
    expect(() =>
      format.readProductionAnswer({ ...clone(answer), skills: 'none' })
    ).toThrow(expect.objectContaining({ reason: 'unreadable' }));
  });
});

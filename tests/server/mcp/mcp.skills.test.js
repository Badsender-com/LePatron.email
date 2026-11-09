/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The skills a connected application runs (ADR 0012, ADR 0013): a published
// feature skill marked for assistants is a prompt, its arguments drawn from
// its input schema, so the assistant runs it the platform's way with its own
// model; find_skills finds the skills served by intent. Task skills, and a
// feature skill that is not marked, are in mcp.task-skills.test.js.

// A schema that takes a required argument named like what every object
// inherits, which no schema of the code does.
jest.mock(
  '../../../packages/server/ai-skill/schemas/describe-schema.js',
  () => {
    const actual = jest.requireActual(
      '../../../packages/server/ai-skill/schemas/describe-schema.js'
    );
    return {
      ...actual,
      describeSchema: (schemaId) =>
        schemaId === 'toneInput'
          ? {
              hasExpertiseField: false,
              fields: [{ name: 'toString', required: true }],
            }
          : actual.describeSchema(schemaId),
    };
  }
);

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const SUBJECT_IDEAS = 'redaction.subject-ideas';
const SCHEMA_ID = 'toneInput';

describe('skills', () => {
  let client;

  beforeEach(async () => {
    harness.seed(f.SEED);
    client = await harness.connectAs(f.WREN);
  });
  afterEach(() => harness.disconnect());

  it('offers the published skills served to assistants, and only them', async () => {
    const { prompts } = await client.listPrompts();

    expect(prompts.map((prompt) => prompt.name)).toEqual([SUBJECT_IDEAS]);
  });

  it('describes a skill with its title and description', async () => {
    const { prompts } = await client.listPrompts();

    expect(prompts[0]).toMatchObject({
      name: SUBJECT_IDEAS,
      title: 'Subject line ideas',
      description: 'Three subject lines for an email',
    });
  });

  // `genericTextInput` takes a required prompt, an optional context, and an
  // expertise the assistant finds itself: the user never types that one.
  it('takes the arguments of its input schema, the expertise excepted', async () => {
    const { prompts } = await client.listPrompts();

    expect(prompts[0].arguments).toEqual([
      expect.objectContaining({ name: 'prompt', required: true }),
      expect.objectContaining({ name: 'context', required: false }),
    ]);
  });

  it('gives the instructions of the active version, the input filled in', async () => {
    const { messages } = await client.getPrompt({
      name: SUBJECT_IDEAS,
      arguments: { prompt: 'Black Friday teaser', context: 'Fashion, B2C' },
    });
    const text = messages.map((message) => message.content.text).join('\n');

    expect(messages[0].role).toBe('user');
    expect(text).toContain('You write email subject lines for a brand.');
    expect(text).toContain(
      'Give three subject lines, each under 50 characters.'
    );
    expect(text).toContain('Brief: Black Friday teaser\nContext: Fashion, B2C');
  });

  it('refuses to run without a required argument', async () => {
    await expect(
      client.getPrompt({ name: SUBJECT_IDEAS, arguments: { context: 'B2C' } })
    ).rejects.toThrow(/prompt/);
  });

  it('does not run a skill that is not active', async () => {
    await expect(
      client.getPrompt({ name: 'qc.unreleased', arguments: {} })
    ).rejects.toThrow(/not found/i);
  });
});

describe('find_skills', () => {
  // More task skills than an answer holds, all about a sending report.
  const REPORTS = Array.from({ length: 12 }, (_, i) => ({
    _id: `507f1f77bcf86cd7994399${String(i).padStart(2, '0')}`,
    skillId: `qc.report-${String(i).padStart(2, '0')}`,
    title: `Read a sending report, part ${i}`,
    description: '',
    category: 'qc',
    status: 'ACTIVE',
    audience: 'all',
    servedToAssistants: false,
    activeVersion: { major: 1, minor: 0 },
    versions: [
      {
        versionMajor: 1,
        versionMinor: 0,
        status: 'ACTIVE',
        nature: 'task',
        procedure: 'Read it.',
        consumedExpertiseIds: [],
      },
    ],
  }));
  let client;

  beforeEach(async () => {
    harness.seed({ ...f.SEED, skills: [...f.SKILLS, ...REPORTS] });
    client = await harness.connectAs(f.WREN);
  });
  afterEach(() => harness.disconnect());

  const find = async (query) =>
    harness.answerOf(
      await client.callTool({ name: 'find_skills', arguments: { query } })
    );

  it('answers ten skills at most', async () => {
    const { skills } = await find('  Sending   REPORT ');

    expect(skills).toHaveLength(10);
    expect(skills[0]).toMatchObject({
      skillId: 'qc.report-00',
      nature: 'task',
    });
  });

  // A blank query is none: mcp.language.test.js lists every skill for it.
  it('refuses a query too long to be an intent', async () => {
    expect((await find('report '.repeat(30))).error).toMatch(
      /Input validation error/
    );
  });
});

// A required argument is one the client sent, by its own name.
const TONE = {
  ...f.SKILLS[0],
  _id: '507f1f77bcf86cd799439915',
  skillId: 'redaction.tone',
  title: 'Set the tone',
  versions: [
    {
      ...f.SKILLS[0].versions[0],
      inputSchemaId: SCHEMA_ID,
      inputTemplate: 'Tone: {{input.toString}}',
    },
  ],
};

describe('a required prompt argument', () => {
  let client;

  beforeEach(async () => {
    harness.seed({ ...f.SEED, skills: [TONE] });
    client = await harness.connectAs(f.WREN);
  });
  afterEach(() => harness.disconnect());

  it('is missing when not sent, even named like what every object has', async () => {
    await expect(
      client.getPrompt({ name: TONE.skillId, arguments: {} })
    ).rejects.toThrow(/Missing required argument: toString/);
  });

  it('is read when sent', async () => {
    const { messages } = await client.getPrompt({
      name: TONE.skillId,
      arguments: { toString: 'warm' },
    });

    expect(messages.map((m) => m.content.text).join('\n')).toContain(
      'Tone: warm'
    );
  });
});

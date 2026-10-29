/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Task skills (ADR 0013): a procedure written for an assistant, with the
// expertises it consumes in order, and no template, schema or contract. Through
// MCP it is a prompt the user picks, a resource the assistant reads and a
// result of find_skills, so the assistant can pick it itself. A feature skill
// is served only when marked so, with its template's placeholders as
// arguments, and never its JSON output contract.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');
const {
  buildOutputContract,
} = require('../../../packages/server/ai-skill/schemas/output-contract.js');

const REPORT = 'qc.read-sending-report';
const TASK_SKILL = {
  _id: '507f1f77bcf86cd799439911',
  skillId: REPORT,
  nature: 'task',
  title: 'Read a sending report',
  description: 'Reads a report the user provides and lists what stands out.',
  category: 'qc',
  status: 'ACTIVE',
  activeVersion: { major: 1, minor: 0 },
  versions: [
    {
      versionMajor: 1,
      versionMinor: 0,
      status: 'ACTIVE',
      procedure:
        '## Steps\n\n1. Describe the report before reading it.\n2. Never guess a missing value.',
      consumedExpertiseIds: [
        'deliverability.spam-words',
        'redaction.subject-line',
      ],
    },
  ],
};
const unmarkedFeature = {
  ...f.SKILLS[0],
  _id: '507f1f77bcf86cd799439912',
  skillId: 'redaction.correction',
  title: 'Correct the spelling',
  servedToAssistants: false,
};
const markedWithoutSchema = {
  ...f.SKILLS[0],
  _id: '507f1f77bcf86cd799439913',
  skillId: 'redaction.objet',
  title: 'Write the subject line',
  servedToAssistants: true,
  versions: [
    {
      ...f.SKILLS[0].versions[0],
      inputSchemaId: 'subjectGenInput', // not in the code's registry
      inputTemplate:
        '<expertise>{{input.expertise}}</expertise>\n<type>{{input.emailType}}</type>\n<content>{{input.content}}</content>\n<brief>{{input.brief}}</brief>',
    },
  ],
};

describe('task skills', () => {
  let client;

  beforeEach(async () => {
    harness.seed({
      ...f.SEED,
      skills: [...f.SKILLS, TASK_SKILL, unmarkedFeature, markedWithoutSchema],
    });
    client = await harness.connectAs(f.FRANK);
  });
  afterEach(() => harness.disconnect());

  const promptNamed = async (name) =>
    (await client.listPrompts()).prompts.find((p) => p.name === name);
  const findSkills = async (query) =>
    harness.answerOf(
      await client.callTool({ name: 'find_skills', arguments: { query } })
    );

  describe('a task skill', () => {
    it('is a prompt with no required argument', async () => {
      const prompt = await promptNamed(REPORT);

      expect(prompt.title).toBe('Read a sending report');
      expect((prompt.arguments || []).filter((a) => a.required)).toEqual([]);
    });

    it('gives its procedure, then the expertises it consumes, in its order', async () => {
      const { messages } = await client.getPrompt({ name: REPORT });
      const [procedure, ...expertises] = messages.map((m) => m.content);

      expect(procedure.text).toContain('Never guess a missing value.');
      expect(expertises.map((content) => content.resource.uri)).toEqual([
        'lepatron://expertises/deliverability.spam-words',
        'lepatron://expertises/redaction.subject-line',
      ]);
      expect(expertises[1].resource.text).toContain(
        'Keep the subject under 50 characters.'
      );
    });

    it('is a resource an assistant reads', async () => {
      const { contents } = await client.readResource({
        uri: `lepatron://skills/${REPORT}`,
      });

      expect(contents[0].mimeType).toBe('text/markdown');
      expect(contents[0].text).toContain(
        'Describe the report before reading it.'
      );
      expect(contents[0].text).toContain(
        'lepatron://expertises/deliverability.spam-words'
      );
    });

    it('is found by intent, from its title or its description', async () => {
      const byTitle = await findSkills('sending report');
      const byDescription = await findSkills('what stands out');

      expect(byTitle.skills).toEqual([
        expect.objectContaining({
          skillId: REPORT,
          uri: `lepatron://skills/${REPORT}`,
        }),
      ]);
      expect(byDescription.skills.map((s) => s.skillId)).toEqual([REPORT]);
    });
  });

  describe('a feature skill', () => {
    it('is neither offered, read nor found unless it is marked', async () => {
      expect(await promptNamed('redaction.correction')).toBeUndefined();
      await expect(
        client.readResource({ uri: 'lepatron://skills/redaction.correction' })
      ).rejects.toThrow(/not found/i);
      expect((await findSkills('spelling')).skills).toEqual([]);
    });

    it('takes the placeholders of its template as arguments, the expertise excepted', async () => {
      const prompt = await promptNamed('redaction.objet');

      expect(prompt.arguments.map((a) => a.name).sort()).toEqual([
        'brief',
        'content',
        'emailType',
      ]);
    });

    it('never sends its JSON output contract', async () => {
      const { messages } = await client.getPrompt({
        name: 'redaction.subject-ideas',
        arguments: { prompt: 'Black Friday teaser' },
      });
      const text = messages.map((m) => m.content.text).join('\n');

      expect(text).not.toContain(buildOutputContract('genericTextOutput'));
    });
  });
});

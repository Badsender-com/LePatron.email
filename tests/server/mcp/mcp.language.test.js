/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The platform company writes its skills and expertises in French, and keeps doing so.
// An assistant used in another language still finds and applies them: the
// server tells it how, and finding a skill does not depend on the words of
// one language.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

// A second skill, which no query of these tests but its own words matches.
const REPORT = {
  _id: '507f1f77bcf86cd799439950',
  skillId: 'qc.sending-report',
  title: 'Read a sending report',
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
};
const EVERY_SKILL = ['qc.sending-report', 'redaction.subject-ideas'];

describe('the language of the skills and expertises', () => {
  let client;
  beforeEach(async () => {
    harness.seed({ ...f.SEED, skills: [...f.SKILLS, REPORT] });
    client = await harness.connectAs(f.FRANK);
  });
  afterEach(() => harness.disconnect());

  const findSkills = async (args) =>
    harness.answerOf(
      await client.callTool({ name: 'find_skills', arguments: args })
    );
  const idsOf = ({ skills }) => skills.map((skill) => skill.skillId).sort();

  it('tells the assistant they are written in French, and to answer in the user’s language', () => {
    const instructions = client.getInstructions();

    expect(instructions).toMatch(/written in French/);
    expect(instructions).toMatch(/user's language/);
    expect(instructions).toMatch(/language of the email/);
  });

  it('lists every skill when the query matches none, whatever its language', async () => {
    const answer = await findSkills({ query: 'Betreffzeilen vorschlagen' });

    expect(answer.matched).toBe(false);
    expect(idsOf(answer)).toEqual(EVERY_SKILL);
  });

  it('lists every skill when asked for none in particular', async () => {
    const answer = await findSkills({});

    expect(answer.matched).toBe(false);
    expect(idsOf(answer)).toEqual(EVERY_SKILL);
  });

  it.each([
    ['an empty query', ''],
    ['a blank query', ' \n '],
  ])('lists every skill for %s, as for none', async (_case, query) => {
    const answer = await findSkills({ query });

    expect(answer.matched).toBe(false);
    expect(idsOf(answer)).toEqual(EVERY_SKILL);
  });

  it('finds a skill by its identifier too', async () => {
    const answer = await findSkills({ query: 'subject-ideas' });

    expect(answer.matched).toBe(true);
    expect(idsOf(answer)).toEqual(['redaction.subject-ideas']);
  });
});

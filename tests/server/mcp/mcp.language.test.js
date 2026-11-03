/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Badsender writes its skills and expertises in French, and keeps doing so.
// An assistant used in another language still finds and applies them: the
// server tells it how, and finding a skill does not depend on the words of
// one language.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

describe('the language of the skills and expertises', () => {
  let client;
  beforeEach(async () => {
    harness.seed(f.SEED);
    client = await harness.connectAs(f.FRANK);
  });
  afterEach(() => harness.disconnect());

  const findSkills = async (args) =>
    harness.answerOf(
      await client.callTool({ name: 'find_skills', arguments: args })
    );

  it('tells the assistant they are written in French, and to answer in the user’s language', () => {
    const instructions = client.getInstructions();

    expect(instructions).toMatch(/written in French/);
    expect(instructions).toMatch(/user's language/);
    expect(instructions).toMatch(/language of the email/);
  });

  it('lists every skill when the query matches none, whatever its language', async () => {
    const answer = await findSkills({ query: 'Betreffzeilen vorschlagen' });

    expect(answer.matched).toBe(false);
    expect(answer.skills.map((skill) => skill.skillId)).toEqual([
      'redaction.subject-ideas',
    ]);
  });

  it('lists every skill when asked for none in particular', async () => {
    const answer = await findSkills({});

    expect(answer.skills.map((skill) => skill.skillId)).toEqual([
      'redaction.subject-ideas',
    ]);
  });

  it('finds a skill by its identifier too', async () => {
    const answer = await findSkills({ query: 'subject-ideas' });

    expect(answer.matched).toBe(true);
    expect(answer.skills.map((skill) => skill.skillId)).toEqual([
      'redaction.subject-ideas',
    ]);
  });
});

/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// set_audience follows the rules of the back office (ADR 0013): opening a
// task skill says which of its consumed expertises stay kept to the platform
// company, and may open those the user chooses with it; keeping an expertise
// to the platform company again says which open task skills lose it. Each
// change is checked first, then applied on the key of the check.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const WRITE = ['mcp:read', 'skills:write'];
const AUDIENCE = 'set_audience';
const SUBJECT_LINES = 'redaction.subject-line';
const SPAM_WORDS = 'deliverability.spam-words';
const WRITE_SUBJECT = 'redaction.write-subject';

const taskSkill = (audience) => ({
  _id: '507f1f77bcf86cd799439903',
  skillId: WRITE_SUBJECT,
  title: 'Write a subject line',
  category: 'redaction',
  status: 'ACTIVE',
  audience,
  activeVersion: { major: 1, minor: 0 },
  versions: [
    {
      versionMajor: 1,
      versionMinor: 0,
      status: 'ACTIVE',
      nature: 'task',
      procedure: '## Steps\n\n1. Write three subjects.',
      consumedExpertiseIds: [SUBJECT_LINES, SPAM_WORDS],
    },
  ],
});

const seedWith = (skillAudience) =>
  harness.seed({
    ...f.SEED,
    expertises: f.EXPERTISES.map((e) => ({ ...e, audience: 'platform' })),
    skills: [...f.SKILLS, taskSkill(skillAudience)],
  });

const stored = (kind, id) =>
  harness
    .stored(kind === 'skill' ? 'skills' : 'expertises')
    .find((doc) => doc[kind === 'skill' ? 'skillId' : 'expertiseId'] === id);

describe('set_audience, as the back office opens and closes', () => {
  afterEach(() => harness.disconnect());

  const connect = () =>
    harness.connectAs(f.ALICE, { group: f.PLATFORM_GROUP, scopes: WRITE });
  const ask = async (client, args) =>
    harness.answerOf(
      await client.callTool({ name: AUDIENCE, arguments: args })
    );
  // The check, then the change on its key, as an assistant makes it.
  const call = async (args) => {
    const client = await connect();
    const check = await ask(client, args);
    if (check.error) return check;
    return ask(client, { ...args, confirmation: check.confirmation });
  };

  it('names at the check the expertises an opening would leave kept, and opens nothing', async () => {
    seedWith('platform');

    const answer = await ask(await connect(), {
      kind: 'skill',
      id: WRITE_SUBJECT,
      audience: 'all',
      openExpertiseIds: [SUBJECT_LINES],
    });

    expect(answer).toMatchObject({
      changed: false,
      platformOnlyExpertises: [
        expect.objectContaining({ expertiseId: SPAM_WORDS }),
      ],
    });
    expect(stored('skill', WRITE_SUBJECT).audience).toBe('platform');
    expect(stored('expertise', SUBJECT_LINES).audience).toBe('platform');
  });

  it('refuses a key checked for other expertises to open', async () => {
    seedWith('platform');
    const client = await connect();
    const args = { kind: 'skill', id: WRITE_SUBJECT, audience: 'all' };
    const { confirmation } = await ask(client, args);

    const answer = await ask(client, {
      ...args,
      openExpertiseIds: [SUBJECT_LINES],
      confirmation,
    });

    expect(answer.error).toMatch(/confirmation/i);
    expect(stored('expertise', SUBJECT_LINES).audience).toBe('platform');
  });

  it('opens a task skill alone, and names the expertises it leaves kept', async () => {
    seedWith('platform');

    const answer = await call({
      kind: 'skill',
      id: WRITE_SUBJECT,
      audience: 'all',
    });

    expect(answer).toMatchObject({
      audience: 'all',
      clientsRead: '1.0',
      platformOnlyExpertises: [
        expect.objectContaining({ expertiseId: SUBJECT_LINES }),
        expect.objectContaining({ expertiseId: SPAM_WORDS }),
      ],
      warnings: [],
    });
    expect(stored('expertise', SUBJECT_LINES).audience).toBe('platform');
  });

  it('opens with it the consumed expertises the user chose', async () => {
    seedWith('platform');

    const answer = await call({
      kind: 'skill',
      id: WRITE_SUBJECT,
      audience: 'all',
      openExpertiseIds: [SUBJECT_LINES],
    });

    expect(stored('expertise', SUBJECT_LINES).audience).toBe('all');
    expect(stored('expertise', SPAM_WORDS).audience).toBe('platform');
    expect(answer.platformOnlyExpertises).toEqual([
      expect.objectContaining({ expertiseId: SPAM_WORDS }),
    ]);
  });

  it('opens nothing it was not offered', async () => {
    seedWith('platform');

    const answer = await call({
      kind: 'skill',
      id: WRITE_SUBJECT,
      audience: 'all',
      openExpertiseIds: ['design.dark-mode'],
    });

    expect(answer.error).toMatch(/SKILL_OPEN_EXPERTISES_INVALID/);
    expect(stored('skill', WRITE_SUBJECT).audience).toBe('platform');
  });

  it('takes the expertises to open only with a skill it opens', async () => {
    seedWith('all');

    const answer = await call({
      kind: 'expertise',
      id: SUBJECT_LINES,
      audience: 'all',
      openExpertiseIds: [SPAM_WORDS],
    });

    expect(answer.error).toMatch(/openExpertiseIds/);
    expect(stored('expertise', SUBJECT_LINES).audience).toBe('platform');
  });

  it('names the open task skills an expertise kept again no longer reaches', async () => {
    seedWith('all');

    const answer = await call({
      kind: 'expertise',
      id: SUBJECT_LINES,
      audience: 'platform',
    });

    expect(answer).toMatchObject({
      audience: 'platform',
      openTaskSkills: [expect.objectContaining({ skillId: WRITE_SUBJECT })],
    });
  });
});

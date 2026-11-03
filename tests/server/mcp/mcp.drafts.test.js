/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The drafts mode (#1385, ADR 0014): a super admin turns it on for their
// connection, and reads every skill and expertise at its latest draft, the
// expertises a skill consumes included, to try a draft before publishing it.
// Anyone else, or the mode off or expired, reads the published versions.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const WRITE = ['mcp:read', 'skills:write'];
const GRANT = 'grant-of-alice';
const HOUR = 3600 * 1000;

const SUBJECT_LINES = 'lepatron://expertises/redaction.subject-line';
const DARK_MODE = 'lepatron://expertises/design.dark-mode';
const PUBLISHED_SUBJECT = 'Keep the subject under 50 characters.';
const DRAFT_SUBJECT = 'A draft nobody validated.';

// A task skill with a draft that consumes one more expertise, never published.
const REVIEW = {
  _id: '507f1f77bcf86cd799439905',
  skillId: 'redaction.review-subject',
  nature: 'task',
  title: 'Review a subject line',
  description: 'Reviews a subject line the Badsender way',
  category: 'redaction',
  status: 'ACTIVE',
  activeVersion: { major: 1, minor: 0 },
  versions: [
    {
      versionMajor: 1,
      versionMinor: 0,
      status: 'ACTIVE',
      procedure: 'The published procedure.',
      consumedExpertiseIds: ['redaction.subject-line'],
    },
    {
      versionMajor: 1,
      versionMinor: 1,
      status: 'DRAFT',
      procedure: 'The draft procedure.',
      consumedExpertiseIds: ['redaction.subject-line', 'design.dark-mode'],
    },
  ],
};

const connection = (draftsUntil) => ({
  _id: '507f1f77bcf86cd799439f01',
  grantId: GRANT,
  clientId: 'test-client',
  clientName: 'An assistant',
  _user: f.ALICE,
  _company: f.PLATFORM_GROUP,
  connectedAt: new Date(),
  lastUsedAt: null,
  draftsUntil,
  expiresAt: new Date(Date.now() + 24 * HOUR),
});

describe('drafts mode', () => {
  beforeEach(() =>
    harness.seed({
      ...f.SEED,
      skills: [...f.SEED.skills, REVIEW],
      connections: [connection(null)],
    })
  );
  afterEach(() => harness.disconnect());

  const asAuthor = (options = {}) =>
    harness.connectAs(f.ALICE, {
      group: f.PLATFORM_GROUP,
      scopes: WRITE,
      grantId: GRANT,
      ...options,
    });
  const call = async (client, name, args) =>
    harness.answerOf(await client.callTool({ name, arguments: args }));
  const read = async (client, uri) =>
    (await client.readResource({ uri })).contents[0].text;
  const promptText = async (client, name) =>
    (await client.getPrompt({ name })).messages
      .map(({ content }) => content.text || content.resource.text)
      .join('\n');
  const turnOn = (client) => call(client, 'use_drafts', { on: true });

  describe('who may use it', () => {
    it('lists the tool to a token with the skills:write scope only', async () => {
      const author = await asAuthor();
      const reader = await asAuthor({ scopes: ['mcp:read'] });

      const names = async (client) =>
        (await client.listTools()).tools.map((tool) => tool.name);

      expect(await names(author)).toContain('use_drafts');
      expect(await names(reader)).not.toContain('use_drafts');
    });

    it('serves a reader the published versions, the mode on or not', async () => {
      harness.update('connections', connection()._id, {
        draftsUntil: new Date(Date.now() + HOUR),
      });
      const reader = await asAuthor({ scopes: ['mcp:read'] });

      expect(await read(reader, SUBJECT_LINES)).toContain(PUBLISHED_SUBJECT);
    });

    it('says when the connection cannot keep the mode', async () => {
      const author = await asAuthor({ grantId: undefined });

      expect(await turnOn(author)).toEqual({
        error: expect.stringMatching(/connection/i),
      });
    });
  });

  describe('what it serves', () => {
    it('serves the published versions until it is turned on', async () => {
      const author = await asAuthor();

      expect(await read(author, SUBJECT_LINES)).toContain(PUBLISHED_SUBJECT);
    });

    it('serves an expertise at its latest draft, and says so', async () => {
      const author = await asAuthor();

      const answer = await turnOn(author);
      const text = await read(author, SUBJECT_LINES);

      expect(answer).toEqual({ drafts: true, until: expect.any(String) });
      expect(text).toContain(DRAFT_SUBJECT);
      expect(text).toMatch(/draft 3\.0/i);
    });

    it('serves an expertise never published', async () => {
      const author = await asAuthor();
      await turnOn(author);

      const { resources } = await author.listResources();

      expect(resources.map((resource) => resource.uri)).toContain(DARK_MODE);
    });

    it('serves a task skill at its draft, and the expertises it consumes at theirs', async () => {
      const author = await asAuthor();
      await turnOn(author);

      const text = await promptText(author, 'redaction.review-subject');

      expect(text).toContain('The draft procedure.');
      expect(text).toMatch(/draft 1\.1/i);
      expect(text).toContain(DRAFT_SUBJECT);
      expect(text).toContain('Not validated yet.');
    });

    it('serves the published versions once turned off', async () => {
      const author = await asAuthor();
      await turnOn(author);

      const answer = await call(author, 'use_drafts', { on: false });

      expect(answer).toEqual({ drafts: false, until: null });
      expect(await read(author, SUBJECT_LINES)).toContain(PUBLISHED_SUBJECT);
    });

    it('serves the published versions once the mode has expired', async () => {
      harness.update('connections', connection()._id, {
        draftsUntil: new Date(Date.now() - 1000),
      });
      const author = await asAuthor();

      expect(await read(author, SUBJECT_LINES)).toContain(PUBLISHED_SUBJECT);
    });
  });

  it('records a feedback given on a draft with the draft version', async () => {
    const author = await asAuthor();
    await turnOn(author);

    await call(author, 'submit_feedback', {
      rating: 'down',
      references: [{ kind: 'expertise', id: 'redaction.subject-line' }],
    });

    const [feedback] = harness.stored('feedbacks');
    expect(feedback.references).toEqual([
      { kind: 'expertise', id: 'redaction.subject-line', version: '3.0' },
    ]);
  });
});

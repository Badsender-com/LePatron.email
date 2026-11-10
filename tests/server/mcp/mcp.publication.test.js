/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Publishing and opening from an assistant (ADR 0019, epic #1422, amending
// ADR 0014): a token with the skills:write scope, held by someone who may
// manage the platform, publishes a draft and opens or closes an audience, each
// in two calls: the first changes nothing and answers what will change (the
// guard, or what clients will read) with a key, the second applies the change
// on that key. A draft is never opened to clients.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const WRITE = ['mcp:read', 'skills:write'];
const SUBJECT_LINES = 'redaction.subject-line'; // 2.1 active, 3.0 draft
const DARK_MODE = 'design.dark-mode'; // never published
const PUBLISH = 'publish_draft';
const AUDIENCE = 'set_audience';

const SEED = {
  ...f.SEED,
  expertises: f.EXPERTISES.map((e) => ({ ...e, audience: 'platform' })),
};

const subjectLines = () =>
  harness.stored('expertises').find((e) => e.expertiseId === SUBJECT_LINES);
const versionOf = (doc, major, minor) =>
  doc.versions.find(
    (v) => v.versionMajor === major && v.versionMinor === minor
  );

describe('publishing and opening from an assistant', () => {
  beforeEach(() => harness.seed(SEED));
  afterEach(() => harness.disconnect());

  const asAuthor = () =>
    harness.connectAs(f.ALICE, { group: f.PLATFORM_GROUP, scopes: WRITE });
  const call = async (client, name, args) =>
    harness.answerOf(await client.callTool({ name, arguments: args }));
  const toolsOf = async (client) => (await client.listTools()).tools;

  // Turned on by #1434 (opening and closing an audience from an assistant)
  describe.skip('the audience', () => {
    it('is changed by a tool listed only with the skills:write scope', async () => {
      const reader = await harness.connectAs(f.ALICE, {
        group: f.PLATFORM_GROUP,
      });

      expect((await toolsOf(reader)).map((t) => t.name)).not.toContain(
        AUDIENCE
      );
      expect((await toolsOf(await asAuthor())).map((t) => t.name)).toContain(
        AUDIENCE
      );
    });

    it('is a destructive tool, every parameter described', async () => {
      const tool = (await toolsOf(await asAuthor())).find(
        (t) => t.name === AUDIENCE
      );

      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      });
      Object.values(tool.inputSchema.properties).forEach((property) =>
        expect(property.description).toEqual(expect.any(String))
      );
    });

    it('changes nothing at the first call, and answers what clients will read with a key', async () => {
      const answer = await call(await asAuthor(), AUDIENCE, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        audience: 'all',
      });

      expect(answer).toMatchObject({
        id: SUBJECT_LINES,
        audience: 'all',
        clientsRead: '2.1',
        changed: false,
        confirmation: expect.any(String),
      });
      expect(subjectLines().audience).toBe('platform');
    });

    it('opens an active expertise to every company on the key of the change checked', async () => {
      const client = await asAuthor();
      const { confirmation } = await call(client, AUDIENCE, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        audience: 'all',
      });

      const answer = await call(client, AUDIENCE, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        audience: 'all',
        confirmation,
      });

      expect(answer).toMatchObject({
        id: SUBJECT_LINES,
        audience: 'all',
        clientsRead: '2.1',
        changed: true,
      });
      expect(subjectLines().audience).toBe('all');
    });

    it('closes it back to the platform company, in two steps too', async () => {
      const client = await asAuthor();
      const change = async (audience) => {
        const { confirmation } = await call(client, AUDIENCE, {
          kind: 'expertise',
          id: SUBJECT_LINES,
          audience,
        });
        return call(client, AUDIENCE, {
          kind: 'expertise',
          id: SUBJECT_LINES,
          audience,
          confirmation,
        });
      };
      await change('all');

      const answer = await change('platform');

      expect(answer).toMatchObject({ audience: 'platform', changed: true });
      expect(subjectLines().audience).toBe('platform');
    });

    it('refuses a key when the audience changed after the check', async () => {
      const client = await asAuthor();
      const { confirmation } = await call(client, AUDIENCE, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        audience: 'all',
      });
      // Opened meanwhile, in the back office or by another conversation
      harness.update('expertises', subjectLines()._id, { audience: 'all' });

      const answer = await call(client, AUDIENCE, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        audience: 'all',
        confirmation,
      });

      expect(answer.error).toMatch(/changed/i);
    });

    it('refuses a key made up or given for another change', async () => {
      const client = await asAuthor();
      const { confirmation } = await call(client, AUDIENCE, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        audience: 'all',
      });

      const madeUp = await call(client, AUDIENCE, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        audience: 'all',
        confirmation: 'made-up',
      });
      const otherChange = await call(client, AUDIENCE, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        audience: 'platform',
        confirmation,
      });

      expect(madeUp.error).toMatch(/confirmation/i);
      expect(otherChange.error).toMatch(/confirmation/i);
      expect(subjectLines().audience).toBe('platform');
    });

    it('never opens what was never published', async () => {
      const answer = await call(await asAuthor(), AUDIENCE, {
        kind: 'expertise',
        id: DARK_MODE,
        audience: 'all',
      });

      expect(answer.error).toMatch(/never published/i);
    });

    it('refuses a user who may not manage the platform, whatever the token says', async () => {
      const client = await harness.connectAs(f.ERIN, { scopes: WRITE });

      const answer = await call(client, AUDIENCE, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        audience: 'all',
      });

      expect(answer.error).toMatch(/not allowed/i);
    });
  });

  // Turned on by #1435 (publishing a draft from an assistant, in two steps)
  describe.skip('publishing a draft', () => {
    it('is a destructive tool listed only with the skills:write scope', async () => {
      const reader = await harness.connectAs(f.ALICE, {
        group: f.PLATFORM_GROUP,
      });
      expect((await toolsOf(reader)).map((t) => t.name)).not.toContain(PUBLISH);

      const tool = (await toolsOf(await asAuthor())).find(
        (t) => t.name === PUBLISH
      );
      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
    });

    it('publishes nothing at the first call, and answers the guard with a key', async () => {
      const answer = await call(await asAuthor(), PUBLISH, {
        kind: 'expertise',
        id: SUBJECT_LINES,
      });

      expect(answer).toMatchObject({
        id: SUBJECT_LINES,
        version: '3.0',
        published: false,
        guard: { usedBy: [], cases: [], missing: [] },
        confirmation: expect.any(String),
      });
      expect(subjectLines().activeVersion).toEqual({ major: 2, minor: 1 });
    });

    it('publishes on the key of the draft checked', async () => {
      const client = await asAuthor();
      const { confirmation } = await call(client, PUBLISH, {
        kind: 'expertise',
        id: SUBJECT_LINES,
      });

      const answer = await call(client, PUBLISH, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        confirmation,
      });

      expect(answer).toMatchObject({ version: '3.0', published: true });
      expect(subjectLines().activeVersion).toEqual({ major: 3, minor: 0 });
      expect(versionOf(subjectLines(), 2, 1).status).toBe('ARCHIVED');
    });

    it('refuses a key when the draft changed after the check', async () => {
      const client = await asAuthor();
      const { confirmation } = await call(client, PUBLISH, {
        kind: 'expertise',
        id: SUBJECT_LINES,
      });
      await call(client, 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: '## [length] Length\n\nChanged after the check.',
        changelog: 'Changed',
      });

      const answer = await call(client, PUBLISH, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        confirmation,
      });

      expect(answer.error).toMatch(/changed/i);
      expect(subjectLines().activeVersion).toEqual({ major: 2, minor: 1 });
    });

    it('refuses a key made up or given for another draft', async () => {
      const answer = await call(await asAuthor(), PUBLISH, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        confirmation: 'made-up',
      });

      expect(answer.error).toMatch(/confirmation/i);
    });

    it('says when there is no draft to publish', async () => {
      const answer = await call(await asAuthor(), PUBLISH, {
        kind: 'expertise',
        id: 'deliverability.spam-words',
      });

      expect(answer.error).toMatch(/no draft/i);
    });

    it('records the publication with the user, the application and the guard', async () => {
      const client = await asAuthor();
      const { confirmation } = await call(client, PUBLISH, {
        kind: 'expertise',
        id: SUBJECT_LINES,
      });
      await call(client, PUBLISH, {
        kind: 'expertise',
        id: SUBJECT_LINES,
        confirmation,
      });

      expect(versionOf(subjectLines(), 3, 0).guardHistory).toEqual([
        expect.objectContaining({
          decision: 'published',
          by: f.ALICE,
          application: 'test-client',
        }),
      ]);
    });

    it('refuses a user who may not manage the platform, whatever the token says', async () => {
      const client = await harness.connectAs(f.ERIN, { scopes: WRITE });

      const answer = await call(client, PUBLISH, {
        kind: 'expertise',
        id: SUBJECT_LINES,
      });

      expect(answer.error).toMatch(/not allowed/i);
    });
  });
});

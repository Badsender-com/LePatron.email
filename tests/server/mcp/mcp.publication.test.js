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
const READ_CHECK = 'read_publication_check';
const AUDIENCE = 'set_audience';

// Another super admin, for a key or a check that is not theirs.
const OLGA = '507f1f77bcf86cd79943910f';
const SEED = {
  ...f.SEED,
  users: [
    ...f.SEED.users,
    {
      ...f.SEED.users.find((u) => u._id === f.ALICE),
      _id: OLGA,
      name: 'Olga',
      email: 'olga@example.test',
    },
  ],
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
  describe('publishing a draft', () => {
    // A major needs its changelog and release notes, as in the back office.
    const DRAFT = {
      kind: 'expertise',
      id: SUBJECT_LINES,
      changelog: 'Shorter subjects',
      releaseNotes: 'Subjects get shorter.',
    };
    const check = (client, args = {}) =>
      call(client, PUBLISH, { ...DRAFT, ...args });
    const confirm = (client, confirmation, args = {}) =>
      call(client, PUBLISH, { ...DRAFT, confirmation, ...args });

    it('is a destructive tool listed only with the skills:write scope', async () => {
      const reader = await harness.connectAs(f.ALICE, {
        group: f.PLATFORM_GROUP,
      });
      const names = (await toolsOf(reader)).map((t) => t.name);
      expect(names).not.toContain(PUBLISH);
      expect(names).not.toContain(READ_CHECK);

      const tools = await toolsOf(await asAuthor());
      expect(tools.find((t) => t.name === PUBLISH).annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
      expect(
        tools.find((t) => t.name === READ_CHECK).annotations
      ).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    });

    it('publishes nothing at the first call, and answers the guard with a key', async () => {
      const answer = await check(await asAuthor());

      expect(answer).toMatchObject({
        id: SUBJECT_LINES,
        version: '3.0',
        published: false,
        status: 'done',
        guard: { usedBy: [], cases: [], missing: [] },
        confirmation: expect.any(String),
      });
      expect(subjectLines().activeVersion).toEqual({ major: 2, minor: 1 });
    });

    // The guard runs on the server (ADR 0019): no call waits for the AI.
    it('starts the guard on the server, and answers it once done to whoever reads it', async () => {
      const publication = require('../../../packages/server/ai-skill/services/skills-publication.service.js');
      const guardRuns = require('../../../packages/server/ai-skill/services/guard-runs.js');
      const USED_BY = [{ featureType: 'subject_generation' }];
      const plan = jest
        .spyOn(publication, 'planPublication')
        .mockResolvedValue({ usedBy: USED_BY, calls: 4, missing: [] });
      const real = publication.guardPublication;
      let replayed;
      const replay = jest
        .spyOn(publication, 'guardPublication')
        .mockImplementation(
          (...args) =>
            new Promise((resolve) => {
              replayed = () => resolve(real(...args));
            })
        );
      try {
        const client = await asAuthor();

        const started = await check(client);
        const { guardId } = started;
        const stillRunning = await call(client, READ_CHECK, { guardId });
        replayed();
        await guardRuns.guardRunsSettled();
        const done = await call(client, READ_CHECK, { guardId });
        const someoneElse = await call(
          await harness.connectAs(OLGA, {
            group: f.PLATFORM_GROUP,
            scopes: WRITE,
          }),
          READ_CHECK,
          { guardId }
        );

        expect(started).toMatchObject({
          status: 'running',
          guardId: expect.any(String),
          guard: { usedBy: USED_BY, calls: 4 },
          next: expect.stringMatching(/read_publication_check/),
        });
        expect(started.confirmation).toBeUndefined();
        expect(stillRunning.status).toBe('running');
        expect(done).toMatchObject({
          status: 'done',
          confirmation: expect.any(String),
        });
        expect(someoneElse.error).toMatch(/no check/i);
        expect((await confirm(client, done.confirmation)).published).toBe(true);
      } finally {
        plan.mockRestore();
        replay.mockRestore();
      }
    });

    it('publishes on the key of the draft checked', async () => {
      const client = await asAuthor();
      const { confirmation } = await check(client);

      const answer = await confirm(client, confirmation);

      expect(answer).toMatchObject({ version: '3.0', published: true });
      expect(subjectLines().activeVersion).toEqual({ major: 3, minor: 0 });
      expect(versionOf(subjectLines(), 2, 1).status).toBe('ARCHIVED');
      expect(versionOf(subjectLines(), 3, 0)).toMatchObject({
        changelog: DRAFT.changelog,
        releaseNotes: DRAFT.releaseNotes,
      });
    });

    it('refuses a major version without its changelog, as the back office does', async () => {
      const answer = await call(await asAuthor(), PUBLISH, {
        kind: 'expertise',
        id: SUBJECT_LINES,
      });

      expect(answer.error).toMatch(/changelog/i);
      expect(harness.stored('guardRuns')).toEqual([]);
    });

    it('refuses other release notes than the ones checked', async () => {
      const client = await asAuthor();
      const { confirmation } = await check(client);

      const answer = await confirm(client, confirmation, {
        releaseNotes: 'Something else.',
      });

      expect(answer.error).toMatch(/differ/i);
      expect(subjectLines().activeVersion).toEqual({ major: 2, minor: 1 });
    });

    it('refuses a key when the draft changed after the check', async () => {
      const client = await asAuthor();
      const { confirmation } = await check(client);
      await call(client, 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: '## [length] Length\n\nChanged after the check.',
        changelog: 'Changed',
      });

      const answer = await confirm(client, confirmation);

      expect(answer.error).toMatch(/changed/i);
      expect(subjectLines().activeVersion).toEqual({ major: 2, minor: 1 });
    });

    // Up to the write itself: a draft written between the check of the key
    // and the publication is refused by the versioning (ADR 0014).
    it('publishes on the condition that the draft checked is the one written', async () => {
      const publication = require('../../../packages/server/ai-skill/services/skills-publication.service.js');
      const publish = jest.spyOn(publication, 'publishVersion');
      const readAt = new Date('2026-11-04T10:00:00.000Z');
      harness.seed({
        ...SEED,
        expertises: SEED.expertises.map((e) =>
          e.expertiseId === SUBJECT_LINES
            ? {
                ...e,
                versions: e.versions.map((v) =>
                  v.status === 'DRAFT' ? { ...v, updatedAt: readAt } : v
                ),
              }
            : e
        ),
      });
      const client = await asAuthor();
      const { confirmation } = await check(client);

      await confirm(client, confirmation);

      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ updatedAt: readAt }),
        }),
        expect.anything()
      );
      publish.mockRestore();
    });

    it('refuses a key made up, or given to another person', async () => {
      const { confirmation } = await check(await asAuthor());
      const other = await harness.connectAs(OLGA, {
        group: f.PLATFORM_GROUP,
        scopes: WRITE,
      });

      const madeUp = await confirm(await asAuthor(), 'made-up');
      const someoneElse = await confirm(other, confirmation);

      expect(madeUp.error).toMatch(/confirmation/i);
      expect(someoneElse.error).toMatch(/confirmation/i);
      expect(subjectLines().activeVersion).toEqual({ major: 2, minor: 1 });
    });

    it('refuses a key given more than an hour ago', async () => {
      const client = await asAuthor();
      const { confirmation } = await check(client);
      const later = Date.now() + 61 * 60 * 1000;
      const clock = jest.spyOn(Date, 'now').mockReturnValue(later);

      try {
        const answer = await confirm(client, confirmation);

        expect(answer.error).toMatch(/expired/i);
        expect(subjectLines().activeVersion).toEqual({ major: 2, minor: 1 });
      } finally {
        clock.mockRestore();
      }
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
      const { confirmation } = await check(client);
      await confirm(client, confirmation);

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

      const answer = await check(client);

      expect(answer.error).toMatch(/not allowed/i);
    });
  });
});

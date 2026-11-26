/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// `search` covers the skills (ADR 0031): one search finds the mailings, the
// expertises and the skills a company may use, and `fetch` reads a skill
// with its version and publication date.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const PUBLISHED = '2026-11-17T09:30:00.000Z';
// Opened to every company after its publication: a client dates the version
// it was opened at by the opening (ADR 0031).
const OPENED = '2026-11-20T08:00:00.000Z';
const SUBJECT_IDEAS = f.SKILLS.find(
  (s) => s.skillId === 'redaction.subject-ideas'
);
const GRANT = 'grant-of-alice';
const HOUR = 3600 * 1000;

const taskVersion = (status, fields = {}) => ({
  versionMajor: 1,
  versionMinor: 0,
  status,
  nature: 'task',
  procedure: 'Read every subject line.',
  ...fields,
});
const skill = (n, skillId, title, fields) => ({
  _id: `507f1f77bcf86cd79943990${n}`,
  skillId,
  title,
  description: '',
  category: 'redaction',
  status: 'ACTIVE',
  audience: 'all',
  activeVersion: { major: 1, minor: 0 },
  versions: [taskVersion('ACTIVE')],
  ...fields,
});

const SEED = {
  ...f.SEED,
  skills: [
    {
      ...SUBJECT_IDEAS,
      audienceHistory: [{ audience: 'all', at: new Date(OPENED), _by: null }],
      versions: SUBJECT_IDEAS.versions.map((v) => ({
        ...v,
        activatedAt: new Date(PUBLISHED),
      })),
    },
    // A task skill kept to the platform company.
    skill(3, 'redaction.subject-audit', 'Subject line audit', {
      description: 'Audits the subject lines of a campaign',
      audience: 'platform',
    }),
    // A feature skill open to every company, not marked for assistants.
    skill(4, 'redaction.subject-rewrite', 'Subject line rewrite', {
      versions: [taskVersion('ACTIVE', { nature: 'feature' })],
      servedToAssistants: false,
    }),
    // A task skill open to every company, archived.
    skill(5, 'redaction.subject-retired', 'Subject line retired', {
      status: 'ARCHIVED',
    }),
    // A task skill never published, its draft only.
    skill(6, 'redaction.subject-sketch', 'Subject line sketch', {
      status: 'DRAFT',
      audience: 'platform',
      activeVersion: { major: null, minor: 0 },
      versions: [taskVersion('DRAFT')],
    }),
  ],
  connections: [
    {
      _id: '507f1f77bcf86cd799439f01',
      grantId: GRANT,
      clientId: 'test-client',
      clientName: 'An assistant',
      _user: f.ALICE,
      _company: f.PLATFORM_GROUP,
      connectedAt: new Date(),
      lastUsedAt: null,
      draftsUntil: new Date(Date.now() + HOUR),
      expiresAt: new Date(Date.now() + 24 * HOUR),
    },
  ],
};

// Every role of a client company (ADR 0004).
const CLIENTS = [
  ['a regular user', f.FRANK],
  ['a company admin', f.ERIN],
  ['a writer', f.WREN],
  ['a reviewer', f.REX],
];

const call = async (client, name, args) =>
  harness.answerOf(await client.callTool({ name, arguments: args }));
const asPlatform = (options = {}) =>
  harness.connectAs(f.ALICE, { group: f.PLATFORM_GROUP, ...options });
// Whether a search finds this skill, and fetch reads it.
async function finds(client, query, skillId) {
  const { results } = await call(client, 'search', { query });
  const fetched = await call(client, 'fetch', { id: `skill:${skillId}` });
  return {
    found: results.map((r) => r.id).includes(`skill:${skillId}`),
    read: !fetched.error,
  };
}
const NEITHER = { found: false, read: false };
const BOTH = { found: true, read: true };

describe('search covers the skills', () => {
  beforeEach(() => harness.seed(SEED));
  afterEach(() => harness.disconnect());

  // Turned on by #1671 (search covers the skills)
  describe('a search', () => {
    it.each(CLIENTS)(
      'finds for %s a skill by the words of its title or description',
      async (_role, userId) => {
        const { results } = await call(
          await harness.connectAs(userId),
          'search',
          { query: 'subject ideas' }
        );

        expect(results).toContainEqual({
          id: 'skill:redaction.subject-ideas',
          title: 'Subject line ideas',
          url: 'lepatron://skills/redaction.subject-ideas',
        });
      }
    );

    it('finds a skill by the words of its id', async () => {
      const { results } = await call(await asPlatform(), 'search', {
        query: 'redaction.subject-au',
      });

      expect(results.map((r) => r.id)).toEqual([
        'skill:redaction.subject-audit',
      ]);
    });

    it.each(CLIENTS)(
      'never finds for %s a skill kept to the platform company',
      async (_role, userId) => {
        const client = await harness.connectAs(userId);

        expect(await finds(client, 'audit', 'redaction.subject-audit')).toEqual(
          NEITHER
        );
      }
    );

    it('finds it for the platform company', async () => {
      expect(
        await finds(await asPlatform(), 'audit', 'redaction.subject-audit')
      ).toEqual(BOTH);
    });

    it.each([
      ['a client', () => harness.connectAs(f.FRANK)],
      ['the platform company', () => asPlatform()],
    ])(
      'never finds for %s a feature skill not marked for assistants',
      async (_case, connect) => {
        expect(
          await finds(await connect(), 'rewrite', 'redaction.subject-rewrite')
        ).toEqual(NEITHER);
      }
    );

    it.each([
      ['a client', () => harness.connectAs(f.FRANK)],
      ['the platform company', () => asPlatform()],
    ])('never finds for %s an archived skill', async (_case, connect) => {
      expect(
        await finds(await connect(), 'retired', 'redaction.subject-retired')
      ).toEqual(NEITHER);
    });

    describe('a skill never published', () => {
      const WRITE = ['mcp:read', 'skills:write'];

      it('is found in drafts mode, on the platform company connection', async () => {
        const client = await asPlatform({ scopes: WRITE, grantId: GRANT });

        expect(
          await finds(client, 'sketch', 'redaction.subject-sketch')
        ).toEqual(BOTH);
      });

      it.each([
        ['the platform company without the drafts mode', () => asPlatform()],
        [
          'a super admin on a client connection',
          () =>
            harness.connectAs(f.ALICE, {
              group: f.CLIENT_GROUP,
              scopes: WRITE,
              grantId: GRANT,
            }),
        ],
        ['a client', () => harness.connectAs(f.FRANK)],
      ])('is not found by %s', async (_case, connect) => {
        expect(
          await finds(await connect(), 'sketch', 'redaction.subject-sketch')
        ).toEqual(NEITHER);
      });
    });

    it('reads a skill with its version and publication date', async () => {
      const document = await call(await asPlatform(), 'fetch', {
        id: 'skill:redaction.subject-ideas',
      });

      expect(document).toMatchObject({
        id: 'skill:redaction.subject-ideas',
        title: 'Subject line ideas',
        url: 'lepatron://skills/redaction.subject-ideas',
        metadata: { version: '1.2', publishedAt: PUBLISHED },
      });
      expect(document.text).toContain(
        'Version 1.2, published on 2026-11-17 (UTC).'
      );
    });

    it.each(CLIENTS)(
      'dates for %s the version it was opened at by the opening',
      async (_role, userId) => {
        const document = await call(await harness.connectAs(userId), 'fetch', {
          id: 'skill:redaction.subject-ideas',
        });

        expect(document.metadata).toMatchObject({
          version: '1.2',
          publishedAt: OPENED,
        });
        expect(document.text).toContain(
          'Version 1.2, published on 2026-11-20 (UTC).'
        );
      }
    );
  });
});

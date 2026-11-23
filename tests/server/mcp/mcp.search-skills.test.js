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
const SUBJECT_IDEAS = f.SKILLS.find(
  (s) => s.skillId === 'redaction.subject-ideas'
);
const SEED = {
  ...f.SEED,
  skills: [
    {
      ...SUBJECT_IDEAS,
      versions: SUBJECT_IDEAS.versions.map((v) => ({
        ...v,
        activatedAt: new Date(PUBLISHED),
      })),
    },
    // A task skill kept to the platform company.
    {
      _id: '507f1f77bcf86cd799439903',
      skillId: 'redaction.subject-audit',
      title: 'Subject line audit',
      description: 'Audits the subject lines of a campaign',
      category: 'redaction',
      status: 'ACTIVE',
      audience: 'platform',
      activeVersion: { major: 1, minor: 0 },
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          status: 'ACTIVE',
          nature: 'task',
          procedure: 'Read every subject line.',
        },
      ],
    },
  ],
};

const call = async (client, name, args) =>
  harness.answerOf(await client.callTool({ name, arguments: args }));

describe('search covers the skills', () => {
  beforeEach(() => harness.seed(SEED));
  afterEach(() => harness.disconnect());

  // Turned on by #1671 (search covers the skills)
  describe.skip('a search', () => {
    it('finds a skill by the words of its title or description', async () => {
      const { results } = await call(
        await harness.connectAs(f.FRANK),
        'search',
        { query: 'subject ideas' }
      );

      expect(results).toContainEqual({
        id: 'skill:redaction.subject-ideas',
        title: 'Subject line ideas',
        url: 'lepatron://skills/redaction.subject-ideas',
      });
    });

    it('never finds for a client a skill kept to the platform company', async () => {
      const client = await harness.connectAs(f.FRANK);

      const { results } = await call(client, 'search', { query: 'audit' });
      const fetched = await call(client, 'fetch', {
        id: 'skill:redaction.subject-audit',
      });

      expect(results.map((r) => r.id)).not.toContain(
        'skill:redaction.subject-audit'
      );
      expect(fetched.error).toMatch(/not found/i);
    });

    it('finds it for the platform company', async () => {
      const { results } = await call(
        await harness.connectAs(f.ALICE, { group: f.PLATFORM_GROUP }),
        'search',
        { query: 'audit' }
      );

      expect(results.map((r) => r.id)).toContain(
        'skill:redaction.subject-audit'
      );
    });

    it('reads a skill with its version and publication date', async () => {
      const document = await call(await harness.connectAs(f.FRANK), 'fetch', {
        id: 'skill:redaction.subject-ideas',
      });

      expect(document).toMatchObject({
        id: 'skill:redaction.subject-ideas',
        title: 'Subject line ideas',
        url: 'lepatron://skills/redaction.subject-ideas',
        metadata: { version: '1.2', publishedAt: PUBLISHED },
      });
      expect(document.text).toContain('Version 1.2, published on 2026-11-17.');
    });
  });
});

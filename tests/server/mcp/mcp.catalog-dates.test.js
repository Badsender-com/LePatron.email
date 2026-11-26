/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Every skill and expertise an assistant reads says its version and when it
// was published (ADR 0031, epic #1661), in UTC, so an assistant tells whether
// what it read before is still current. A version whose publication was
// never recorded says no date rather than a guessed one.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const SKILL_PUBLISHED = '2026-11-17T09:30:00.000Z';
// A publication saves the version just after it is dated: its last change.
const SKILL_UPDATED = '2026-11-17T09:30:00.120Z';
const EXPERTISE_PUBLISHED = '2026-11-16T22:47:00.000Z';

const publishedAt = (item, iso, fields = {}) => ({
  ...item,
  versions: item.versions.map((v) =>
    v.status === 'ACTIVE' ? { ...v, activatedAt: new Date(iso), ...fields } : v
  ),
});

const SEED = {
  ...f.SEED,
  skills: f.SKILLS.map((skill) =>
    skill.skillId === 'redaction.subject-ideas'
      ? publishedAt(skill, SKILL_PUBLISHED, {
          updatedAt: new Date(SKILL_UPDATED),
        })
      : skill
  ),
  expertises: f.EXPERTISES.map((expertise) =>
    expertise.expertiseId === 'redaction.subject-line'
      ? publishedAt(expertise, EXPERTISE_PUBLISHED)
      : expertise
  ),
};

const call = async (client, name, args) =>
  harness.answerOf(await client.callTool({ name, arguments: args }));
const read = async (client, uri) =>
  (await client.readResource({ uri })).contents[0].text;

// A super admin of the platform company, in the drafts mode.
async function inDraftsMode(records) {
  const GRANT = 'grant-of-the-drafts';
  harness.seed({
    ...records,
    connections: [
      {
        _id: '507f1f77bcf86cd799439f03',
        grantId: GRANT,
        clientId: 'test-client',
        _user: f.ALICE,
        _company: f.PLATFORM_GROUP,
        connectedAt: new Date(),
        draftsUntil: null,
        expiresAt: f.daysFrom(1),
      },
    ],
  });
  const client = await harness.connectAs(f.ALICE, {
    group: f.PLATFORM_GROUP,
    scopes: ['mcp:read', 'skills:write'],
    grantId: GRANT,
  });
  await call(client, 'use_drafts', { on: true });
  return client;
}

describe('catalog dates and versions', () => {
  beforeEach(() => harness.seed(SEED));
  afterEach(() => harness.disconnect());

  // Turned on by #1664 (version and publication date everywhere)
  describe('as an assistant reads them', () => {
    it('gives each skill found its version and publication date', async () => {
      const { skills } = await call(
        await harness.connectAs(f.FRANK),
        'find_skills',
        {}
      );

      expect(skills).toEqual([
        expect.objectContaining({
          skillId: 'redaction.subject-ideas',
          version: '1.2',
          publishedAt: SKILL_PUBLISHED,
        }),
      ]);
    });

    it('gives each expertise found its publication date, or none when it was never recorded', async () => {
      const { expertises } = await call(
        await harness.connectAs(f.FRANK),
        'find_applicable_expertises',
        { scope: ['subject'], categories: ['redaction', 'deliverability'] }
      );
      const byId = Object.fromEntries(
        expertises.map((e) => [e.expertiseId, e])
      );

      expect(byId['redaction.subject-line']).toMatchObject({
        version: '2.1',
        publishedAt: EXPERTISE_PUBLISHED,
      });
      expect(byId['deliverability.spam-words'].publishedAt).toBeNull();
    });

    it('dates the version line of a skill and of an expertise', async () => {
      const client = await harness.connectAs(f.FRANK);

      expect(
        await read(client, 'lepatron://skills/redaction.subject-ideas')
      ).toContain('Version 1.2, published on 2026-11-17 (UTC).');
      expect(
        await read(client, 'lepatron://expertises/redaction.subject-line')
      ).toContain('Version 2.1, published on 2026-11-16 (UTC).');
      expect(
        await read(client, 'lepatron://expertises/deliverability.spam-words')
      ).toContain('Version 1.0.');
    });

    it('says when each skill resource was last modified, its last change rather than its publication', async () => {
      const { resources } = await (
        await harness.connectAs(f.FRANK)
      ).listResources();
      const skill = resources.find(
        (r) => r.uri === 'lepatron://skills/redaction.subject-ideas'
      );

      expect(skill.annotations).toEqual({ lastModified: SKILL_UPDATED });
    });

    it('dates no skill whose publication was never recorded', async () => {
      harness.seed(f.SEED);
      const client = await harness.connectAs(f.FRANK);

      const { skills } = await call(client, 'find_skills', {});

      expect(skills[0]).toMatchObject({ version: '1.2', publishedAt: null });
      expect(
        await read(client, 'lepatron://skills/redaction.subject-ideas')
      ).toContain('Version 1.2.');
    });

    it('gives no lastModified to an expertise whose version has no date', async () => {
      harness.seed({
        ...SEED,
        expertises: SEED.expertises.map((expertise) =>
          expertise.expertiseId === 'deliverability.spam-words'
            ? {
                ...expertise,
                versions: expertise.versions.map((v) => ({
                  ...v,
                  updatedAt: undefined,
                })),
              }
            : expertise
        ),
      });
      const { resources } = await (
        await harness.connectAs(f.FRANK)
      ).listResources();
      const expertise = resources.find(
        (r) => r.uri === 'lepatron://expertises/deliverability.spam-words'
      );

      expect(expertise).not.toHaveProperty('annotations');
    });

    it('answers a draft tried in the drafts mode with no publication date', async () => {
      const client = await inDraftsMode(SEED);

      const { expertises } = await call(client, 'find_applicable_expertises', {
        scope: ['subject'],
        categories: ['redaction'],
      });

      expect(
        expertises.find((e) => e.expertiseId === 'redaction.subject-line')
      ).toMatchObject({ version: '3.0', draft: true, publishedAt: null });
    });

    it('answers a draft skill tried in the drafts mode with no publication date', async () => {
      const client = await inDraftsMode({
        ...SEED,
        skills: SEED.skills.map((skill) =>
          skill.skillId === 'redaction.subject-ideas'
            ? {
                ...skill,
                versions: [
                  ...skill.versions,
                  {
                    ...skill.versions[0],
                    versionMinor: 3,
                    status: 'DRAFT',
                    activatedAt: null,
                  },
                ],
              }
            : skill
        ),
      });

      const { skills } = await call(client, 'find_skills', {});

      expect(
        skills.find((found) => found.skillId === 'redaction.subject-ideas')
      ).toMatchObject({ version: '1.3', draft: true, publishedAt: null });
      expect(
        await read(client, 'lepatron://skills/redaction.subject-ideas')
      ).toContain('Version 1.3.');
    });
  });
});

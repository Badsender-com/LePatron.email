/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Who reads what of the catalog changes (ADR 0031, epic #1661). The catalog
// is the connected company's; the change log and the retex follow the
// person, as a super admin reads them through any connection. A company
// other than the platform company sees only creations, updates and
// withdrawals, and dates the first version it sees by its opening.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');
const s = require('../../helpers/mcp-catalog-changes-seed');

const WEEK = { since: '2026-11-16', until: '2026-11-22' };
const B2B_OPENED = '2026-11-18T12:00:00.000Z';

const call = async (client, name, args) =>
  harness.answerOf(await client.callTool({ name, arguments: args }));
const listChanges = (client, args) => call(client, 'list_changes', args);
const read = async (client, uri) =>
  (await client.readResource({ uri })).contents[0].text;
const ids = ({ changes }) => changes.map((c) => c.id);
const withExpertises = (...more) =>
  harness.seed({ ...s.SEED, expertises: [...s.EXPERTISES, ...more] });

describe('list_changes, as each reader sees it', () => {
  beforeEach(() => harness.seed(s.SEED));
  afterEach(() => harness.disconnect());

  describe('a super admin connected to a client company', () => {
    it("reads the client's catalog, with the change log and the retex addressed", async () => {
      const asFrank = await listChanges(await harness.connectAs(f.FRANK), WEEK);
      const answer = await listChanges(
        await harness.connectAs(f.ALICE, { group: f.CLIENT_GROUP }),
        WEEK
      );

      expect(ids(answer)).toEqual(ids(asFrank));
      expect(ids(answer)).not.toContain('deliverability.snds');
      expect(
        answer.changes.find((c) => c.id === 'redaction.subject-line')
      ).toMatchObject({
        releaseNotes: 'Shorter subjects.',
        changelog: 'Two retex converged',
        addressesRetex: [s.RETEX],
      });
    });
  });

  describe('the other roles of a client company', () => {
    it.each([
      ['a company admin', f.ERIN],
      ['a writer', f.WREN],
      ['a reviewer', f.REX],
    ])(
      'gives %s what a regular user reads, no change log nor retex',
      async (_, userId) => {
        const asFrank = await listChanges(
          await harness.connectAs(f.FRANK),
          WEEK
        );
        const answer = await listChanges(await harness.connectAs(userId), WEEK);

        expect(answer).toEqual(asFrank);
        answer.changes.forEach((change) => {
          expect(change).not.toHaveProperty('changelog');
          expect(change).not.toHaveProperty('addressesRetex');
        });
      }
    );
  });

  describe('an item kept to the platform company, archived', () => {
    it('never shows it to a client, not even withdrawn', async () => {
      withExpertises(
        s.expertise(
          'deliverability.internal',
          'Internal notes',
          [
            s.version('1.0', 'ARCHIVED', {
              activatedAt: new Date('2026-09-15T08:00:00Z'),
            }),
          ],
          {
            audience: 'platform',
            status: 'ARCHIVED',
            archivedAt: new Date('2026-11-19T08:00:00Z'),
          }
        )
      );

      const answer = await listChanges(await harness.connectAs(f.FRANK), {
        since: '2026-09-01',
        until: '2026-11-22',
      });

      expect(ids(answer)).not.toContain('deliverability.internal');
      expect(JSON.stringify(answer)).not.toContain('Internal notes');
    });
  });

  // A company never learns even the title of an item it never saw: no
  // version was published while it was open to it.
  describe('an item a client never saw', () => {
    const SINCE_SEPTEMBER = { since: '2026-09-01', until: '2026-11-22' };

    it('never shows it withdrawn when a draft never published, open to all, is archived', async () => {
      withExpertises(
        s.expertise(
          'redaction.secret',
          'Secret draft',
          [s.version('1.0', 'DRAFT')],
          {
            status: 'ARCHIVED',
            archivedAt: new Date('2026-11-19T08:00:00Z'),
            audienceHistory: [s.archived('2026-11-19T08:00:00Z')],
          }
        )
      );

      const answer = await listChanges(
        await harness.connectAs(f.FRANK),
        SINCE_SEPTEMBER
      );

      expect(ids(answer)).not.toContain('redaction.secret');
      expect(JSON.stringify(answer)).not.toContain('Secret draft');
    });

    it('never shows it withdrawn when it was opened and closed before its first publication', async () => {
      withExpertises(
        s.expertise(
          'deliverability.internal',
          'Internal',
          [
            s.version('1.0', 'ACTIVE', {
              activatedAt: new Date('2026-11-19T08:00:00Z'),
            }),
          ],
          {
            audience: 'platform',
            audienceHistory: [
              s.opened('2026-11-17T08:00:00Z'),
              s.closed('2026-11-18T08:00:00Z'),
            ],
          }
        )
      );

      const answer = await listChanges(
        await harness.connectAs(f.FRANK),
        SINCE_SEPTEMBER
      );

      expect(ids(answer)).not.toContain('deliverability.internal');
      expect(JSON.stringify(answer)).not.toContain('"Internal"');
    });
  });

  describe('an item withdrawn, then opened again', () => {
    it('appears to a client as created again, never opened', async () => {
      withExpertises(
        s.expertise(
          'redaction.back-again',
          'Back again',
          [
            s.version('1.0', 'ACTIVE', {
              activatedAt: new Date('2026-10-01T08:00:00Z'),
            }),
          ],
          {
            audienceHistory: [
              {
                audience: 'all',
                at: new Date('2026-10-02T08:00:00Z'),
                _by: f.ALICE,
              },
              {
                audience: 'platform',
                at: new Date('2026-11-17T08:00:00Z'),
                _by: f.ALICE,
              },
              {
                audience: 'all',
                at: new Date('2026-11-20T08:00:00Z'),
                _by: f.ALICE,
              },
            ],
          }
        )
      );

      const answer = await listChanges(await harness.connectAs(f.FRANK), WEEK);

      expect(
        answer.changes
          .filter((c) => c.id === 'redaction.back-again')
          .map((c) => `${c.at} ${c.change}`)
      ).toEqual([
        '2026-11-17T08:00:00.000Z withdrawn',
        '2026-11-20T08:00:00.000Z created',
      ]);
      expect(answer.changes.map((c) => c.change)).not.toContain('opened');
    });
  });

  describe('an item published before it was opened', () => {
    // b2b.prospection: published on the 10th, opened on the 18th. Its
    // category is one an assistant may ask for.
    beforeEach(() =>
      harness.seed({
        ...s.SEED,
        expertises: s.EXPERTISES.map((expertise) =>
          expertise.expertiseId === 'b2b.prospection'
            ? { ...expertise, category: 'other' }
            : expertise
        ),
      })
    );

    it('is dated for a client by its opening, in find_applicable_expertises', async () => {
      const { expertises } = await call(
        await harness.connectAs(f.FRANK),
        'find_applicable_expertises',
        { scope: ['subject'], categories: ['other'] }
      );

      expect(
        expertises.find((e) => e.expertiseId === 'b2b.prospection')
      ).toMatchObject({ version: '1.0', publishedAt: B2B_OPENED });
    });

    it('is dated for a client by its opening, in its resource', async () => {
      const text = await read(
        await harness.connectAs(f.FRANK),
        'lepatron://expertises/b2b.prospection'
      );

      expect(text).toContain('Version 1.0, published on 2026-11-18 (UTC).');
      expect(text).not.toContain('2026-11-10');
    });

    it('is last modified, for a client, when it was opened', async () => {
      const { resources } = await (
        await harness.connectAs(f.FRANK)
      ).listResources();

      expect(
        resources.find((r) => r.name === 'b2b.prospection').annotations
      ).toEqual({ lastModified: B2B_OPENED });
    });

    it('keeps its publication date for the platform company', async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.PLATFORM_GROUP,
      });
      const { resources } = await client.listResources();

      expect(
        resources.find((r) => r.name === 'b2b.prospection').annotations
      ).toEqual({ lastModified: '2026-11-10T08:00:00.000Z' });
      expect(
        await read(client, 'lepatron://expertises/b2b.prospection')
      ).toContain('Version 1.0, published on 2026-11-10 (UTC).');
    });
  });

  // redaction.late-ideas: published on the 10th, opened on the 18th.
  describe('a skill published before it was opened', () => {
    beforeEach(() =>
      harness.seed({
        ...s.SEED,
        skills: [
          ...s.SKILLS,
          s.skill(
            'redaction.late-ideas',
            'Late ideas',
            [
              s.version('1.0', 'ACTIVE', {
                activatedAt: new Date('2026-11-10T08:00:00Z'),
              }),
            ],
            { audienceHistory: [s.opened(B2B_OPENED)] }
          ),
        ],
      })
    );

    it('is dated for a client by its opening, in find_skills, its resource and its annotation', async () => {
      const client = await harness.connectAs(f.FRANK);
      const { skills } = await call(client, 'find_skills', {});
      const { resources } = await client.listResources();

      expect(
        skills.find((found) => found.skillId === 'redaction.late-ideas')
      ).toMatchObject({ version: '1.0', publishedAt: B2B_OPENED });
      expect(
        await read(client, 'lepatron://skills/redaction.late-ideas')
      ).toContain('Version 1.0, published on 2026-11-18 (UTC).');
      expect(
        resources.find((r) => r.name === 'redaction.late-ideas').annotations
      ).toEqual({ lastModified: B2B_OPENED });
    });
  });
});

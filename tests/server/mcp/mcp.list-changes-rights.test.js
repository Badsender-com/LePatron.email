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

  // Turned on by the block 3 review fixes (#1677, #1678)
  describe.skip('a super admin connected to a client company', () => {
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
        releaseNote: 'Shorter subjects.',
        changeLog: 'Two retex converged',
        addressesRetex: [s.RETEX],
      });
    });
  });

  // Turned on by the block 3 review fixes (#1677, #1678)
  describe.skip('the other roles of a client company', () => {
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
          expect(change).not.toHaveProperty('changeLog');
          expect(change).not.toHaveProperty('addressesRetex');
        });
      }
    );
  });

  // Turned on by the block 3 review fixes (#1677, #1678)
  describe.skip('an item kept to the platform company, archived', () => {
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

  // Turned on by the block 3 review fixes (#1677, #1678)
  describe.skip('an item published before it was opened', () => {
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
  });
});

/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// What changed in the catalog (ADR 0031, epic #1661): `list_changes` lists
// the skills and expertises created, updated, opened and withdrawn in a
// period, as the connected company sees them. A client company reads the
// release notes; the platform company reads the change logs too, and a super
// admin the retex each version addressed.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');
const s = require('../../helpers/mcp-catalog-changes-seed');

const WEEK = { since: '2026-11-16', until: '2026-11-22' };
const LIST = 'list_changes';

const call = async (client, args) =>
  harness.answerOf(await client.callTool({ name: LIST, arguments: args }));
const asClient = () => harness.connectAs(f.FRANK);
const asConsultant = () =>
  harness.connectAs(f.ALICE, { group: f.PLATFORM_GROUP });
const summary = ({ changes }) =>
  changes.map((c) => `${c.at.slice(0, 10)} ${c.change} ${c.id}`);

describe('list_changes', () => {
  beforeEach(() => harness.seed(s.SEED));
  afterEach(() => harness.disconnect());

  // Turned on by #1667 (created and updated items)
  describe('created and updated', () => {
    it('is a read-only tool every connection is offered, every parameter described', async () => {
      const { tools } = await (await asClient()).listTools();
      const tool = tools.find((t) => t.name === LIST);

      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
      });
      Object.values(tool.inputSchema.properties).forEach((property) =>
        expect(property.description).toEqual(expect.any(String))
      );
    });

    it('lists what the platform company published in the week, in order, drafts never', async () => {
      const answer = await call(await asConsultant(), {
        ...WEEK,
        change: ['created', 'updated'],
      });

      expect(summary(answer)).toEqual([
        '2026-11-16 created crm.governance',
        '2026-11-16 updated redaction.subject-ideas',
        '2026-11-17 created deliverability.snds',
        '2026-11-17 created deliverability.snds-dashboard',
        '2026-11-18 updated redaction.subject-line',
        '2026-11-19 updated design.gmail',
      ]);
      expect(answer.truncated).toBe(false);
    });

    it('gives a super admin the release note, the change log and the retex addressed', async () => {
      const { changes } = await call(await asConsultant(), WEEK);

      expect(changes.find((c) => c.id === 'redaction.subject-line')).toEqual({
        kind: 'expertise',
        id: 'redaction.subject-line',
        title: 'Subject lines',
        category: 'redaction',
        change: 'updated',
        at: '2026-11-18T08:00:00.000Z',
        fromVersion: '1.0',
        toVersion: '1.1',
        releaseNotes: 'Shorter subjects.',
        changelog: 'Two retex converged',
        addressesRetex: [s.RETEX],
        audience: 'all',
        uri: 'lepatron://expertises/redaction.subject-line',
      });
      expect(
        changes.find((c) => c.id === 'redaction.subject-ideas')
      ).toMatchObject({
        kind: 'skill',
        fromVersion: '1.2',
        toVersion: '1.3',
        at: '2026-11-16T22:47:00.000Z',
        uri: 'lepatron://skills/redaction.subject-ideas',
      });
    });

    it('answers a first version as created, from no version', async () => {
      const { changes } = await call(await asConsultant(), WEEK);

      expect(changes.find((c) => c.id === 'deliverability.snds')).toMatchObject(
        {
          change: 'created',
          fromVersion: null,
          toVersion: '1.0',
          releaseNotes: 'Read the SNDS portal.',
          audience: 'platform',
        }
      );
    });

    it('answers the old generic sentence as no release note and no change log', async () => {
      const { changes } = await call(await asConsultant(), WEEK);

      expect(changes.find((c) => c.id === 'design.gmail')).toMatchObject({
        releaseNotes: null,
        changelog: null,
      });
    });

    it('gives a client the release notes of what it may use, never the change log nor the retex', async () => {
      const answer = await call(await asClient(), {
        ...WEEK,
        change: ['updated'],
      });

      expect(summary(answer)).toEqual([
        '2026-11-16 updated redaction.subject-ideas',
        '2026-11-18 updated redaction.subject-line',
        '2026-11-19 updated design.gmail',
      ]);
      answer.changes.forEach((change) => {
        expect(change).not.toHaveProperty('changelog');
        expect(change).not.toHaveProperty('addressesRetex');
        expect(change).not.toHaveProperty('audience');
      });
      expect(answer.changes[1].releaseNotes).toBe('Shorter subjects.');
    });

    it('gives a user of the platform company who is no super admin the change log, not the retex', async () => {
      const client = await harness.connectAs(s.PAT);
      const { changes } = await call(client, WEEK);
      const change = changes.find((c) => c.id === 'redaction.subject-line');

      expect(change.changelog).toBe('Two retex converged');
      expect(change).not.toHaveProperty('addressesRetex');
    });

    it('filters by kind', async () => {
      const answer = await call(await asConsultant(), {
        ...WEEK,
        kind: 'skill',
      });

      expect(summary(answer)).toEqual([
        '2026-11-16 updated redaction.subject-ideas',
        '2026-11-17 created deliverability.snds-dashboard',
      ]);
    });

    it('filters by audience, for the platform company', async () => {
      const answer = await call(await asConsultant(), {
        ...WEEK,
        audience: 'platform',
        change: ['created', 'updated'],
      });

      expect(summary(answer)).toEqual([
        '2026-11-17 created deliverability.snds',
        '2026-11-17 created deliverability.snds-dashboard',
      ]);
    });

    it('reads the last seven days by default', async () => {
      harness.seed({
        ...s.SEED,
        expertises: [
          s.expertise('recent.one', 'Recent', [
            s.version('1.0', 'ACTIVE', { activatedAt: f.daysFrom(-3) }),
          ]),
          s.expertise('older.one', 'Older', [
            s.version('1.0', 'ACTIVE', { activatedAt: f.daysFrom(-10) }),
          ]),
        ],
        skills: [],
      });

      const { changes } = await call(await asClient(), {});

      expect(changes.map((c) => c.id)).toEqual(['recent.one']);
    });

    it('takes a day without a time as the whole day, in UTC', async () => {
      const answer = await call(await asConsultant(), {
        since: '2026-11-19',
        until: '2026-11-19',
        change: ['updated'],
      });

      expect(summary(answer)).toEqual(['2026-11-19 updated design.gmail']);
    });

    it('includes the end of a day without a time, in UTC', async () => {
      const answer = await call(await asConsultant(), {
        since: '2026-11-16',
        until: '2026-11-16',
        change: ['updated'],
      });

      expect(summary(answer)).toEqual([
        '2026-11-16 updated redaction.subject-ideas',
      ]);
    });

    it('lists no draft, in the drafts mode either', async () => {
      const GRANT = 'grant-of-the-drafts';
      harness.seed({
        ...s.SEED,
        connections: [
          {
            _id: '507f1f77bcf86cd799439f02',
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
      await client.callTool({ name: 'use_drafts', arguments: { on: true } });

      const { changes } = await call(client, WEEK);

      expect(changes.map((c) => c.toVersion)).not.toContain('1.2');
      expect(changes.map((c) => c.id)).not.toContain('design.dark-mode');
    });

    it('says when it cut the list at 200 changes', async () => {
      const many = Array.from({ length: 201 }, (_, i) =>
        s.expertise(`bulk.item-${String(i).padStart(3, '0')}`, `Item ${i}`, [
          s.version('1.0', 'ACTIVE', {
            activatedAt: new Date(Date.UTC(2026, 10, 17, 0, 0, i)),
          }),
        ])
      );
      harness.seed({ ...s.SEED, expertises: many, skills: [] });

      const answer = await call(await asClient(), WEEK);

      expect(answer.changes).toHaveLength(200);
      expect(answer.truncated).toBe(true);
      // The most recent kept, the oldest first still.
      expect(answer.changes[0].id).toBe('bulk.item-001');
      expect(answer.changes[199].id).toBe('bulk.item-200');
    });

    it('says in its description that it keeps the most recent when it cuts', async () => {
      const { tools } = await (await asClient()).listTools();

      expect(tools.find((t) => t.name === LIST).description).toMatch(
        /200 most recent/
      );
    });

    // What find_skills serves a client: a task skill, or a feature skill
    // marked for assistants (mcp-skill-catalog.js).
    it('lists to a client only the skills find_skills serves it', async () => {
      harness.seed({
        ...s.SEED,
        skills: [
          ...s.SKILLS,
          s.skill(
            'redaction.feature-only',
            'Feature only',
            [
              s.version('1.0', 'ACTIVE', {
                activatedAt: new Date('2026-11-18T09:00:00Z'),
                nature: 'feature',
                releaseNotes: 'Only for the editor.',
              }),
            ],
            { servedToAssistants: false }
          ),
        ],
      });

      const toClient = await call(await asClient(), WEEK);
      const toPlatform = await call(await asConsultant(), WEEK);

      expect(toClient.changes.map((c) => c.id)).not.toContain(
        'redaction.feature-only'
      );
      expect(JSON.stringify(toClient)).not.toContain('Feature only');
      expect(toPlatform.changes.map((c) => c.id)).toContain(
        'redaction.feature-only'
      );
    });

    it('refuses a period that ends before it starts, or a date it cannot read', async () => {
      const client = await asClient();

      expect(
        (await call(client, { since: '2026-11-22', until: '2026-11-16' })).error
      ).toMatch(/since/i);
      expect((await call(client, { since: 'last week' })).error).toMatch(
        /date/i
      );
    });

    it.each([
      ['a month that does not exist', '2026-13-01'],
      ['a day that does not exist', '2026-02-31'],
      ['an hour that does not exist', '2026-11-16T24:00'],
      ['a month alone', '2026-11'],
      ['another form than ISO 8601', '11/16/2026'],
      ['a number', '0'],
      ['a lowercase separator', '2026-11-16t10:00Z'],
    ])('refuses %s, saying what a date is', async (_case, since) => {
      const answer = await call(await asClient(), { since });

      expect(answer.error).toMatch(/is not an ISO 8601 date/);
      expect(answer.error).toContain(since);
    });

    it('reads a date-time without a zone in UTC, and one with an offset at its zone', async () => {
      const client = await asClient();

      expect(
        await call(client, {
          since: '2026-11-16T10:00',
          until: '2026-11-17T10:00:30.5',
        })
      ).toMatchObject({
        since: '2026-11-16T10:00:00.000Z',
        until: '2026-11-17T10:00:30.500Z',
      });
      expect(
        await call(client, { since: '2026-11-16T10:00:00+01:00' })
      ).toMatchObject({ since: '2026-11-16T09:00:00.000Z' });
    });

    it('refuses an empty list of changes', async () => {
      const answer = await call(await asClient(), { ...WEEK, change: [] });

      expect(answer.error).toEqual(expect.any(String));
      expect(answer).not.toHaveProperty('changes');
    });
  });

  // Turned on by #1668 (openings and withdrawals)
  describe('opened and withdrawn', () => {
    it('lists to the platform company the openings and withdrawals of the week', async () => {
      const answer = await call(await asConsultant(), {
        ...WEEK,
        change: ['opened', 'withdrawn'],
      });

      expect(summary(answer)).toEqual([
        '2026-11-18 opened b2b.prospection',
        '2026-11-20 withdrawn redaction.old-tone',
        '2026-11-21 withdrawn redaction.retired',
        '2026-11-21 opened crm.governance',
      ]);
      expect(answer.changes[0]).toMatchObject({
        toVersion: '1.0',
        audience: 'all',
      });
    });

    it('shows a client an item opened to it as created on the day it was opened, never before', async () => {
      const answer = await call(await asClient(), WEEK);

      expect(summary(answer)).toEqual([
        '2026-11-16 updated redaction.subject-ideas',
        '2026-11-18 updated redaction.subject-line',
        '2026-11-18 created b2b.prospection',
        '2026-11-19 updated design.gmail',
        '2026-11-20 withdrawn redaction.old-tone',
        '2026-11-21 withdrawn redaction.retired',
        '2026-11-21 created crm.governance',
      ]);
      expect(
        answer.changes.find((c) => c.id === 'crm.governance')
      ).toMatchObject({
        fromVersion: null,
        toVersion: '1.0',
        at: '2026-11-21T10:40:00.000Z',
        uri: 'lepatron://expertises/crm.governance',
      });
    });

    // The release note is written for every reader: the opening brings
    // the one of the version opened.
    it('gives an opening the release note of the version opened', async () => {
      const toClient = await call(await asClient(), WEEK);
      const toPlatform = await call(await asConsultant(), {
        ...WEEK,
        change: ['opened'],
      });

      expect(
        toClient.changes.find((c) => c.id === 'crm.governance')
      ).toMatchObject({
        change: 'created',
        toVersion: '1.0',
        releaseNotes: 'Audit a CRM governance.',
      });
      expect(
        toClient.changes.find((c) => c.id === 'crm.governance')
      ).not.toHaveProperty('changelog');
      expect(
        toPlatform.changes.find((c) => c.id === 'crm.governance')
      ).toMatchObject({
        change: 'opened',
        fromVersion: null,
        toVersion: '1.0',
        releaseNotes: 'Audit a CRM governance.',
        changelog: 'First version',
        addressesRetex: [],
      });
    });

    it('shows a client a withdrawn item by its title alone', async () => {
      const { changes } = await call(await asClient(), WEEK);

      expect(changes.find((c) => c.id === 'redaction.old-tone')).toEqual({
        kind: 'expertise',
        id: 'redaction.old-tone',
        title: 'Old tone',
        change: 'withdrawn',
        at: '2026-11-20T08:00:00.000Z',
      });
    });

    it('never shows a client a version published while the item was kept to the platform company', async () => {
      const { changes } = await call(await asClient(), {
        since: '2026-11-01',
        until: '2026-11-22',
      });

      expect(
        changes.filter((c) => c.id === 'b2b.prospection').map((c) => c.change)
      ).toEqual(['created']);
    });

    // Archived on the 17th, published again in 1.1 on the 20th: it comes
    // back for whoever reads it, as find_applicable_expertises serves it.
    describe('an item archived, then published again', () => {
      beforeEach(() =>
        harness.seed({
          ...s.SEED,
          expertises: [
            s.expertise(
              'redaction.come-back',
              'Come back',
              [
                s.version('1.0', 'ARCHIVED', {
                  activatedAt: new Date('2026-10-01T08:00:00Z'),
                }),
                s.version('1.1', 'ACTIVE', {
                  activatedAt: new Date('2026-11-20T08:00:00Z'),
                  releaseNotes: 'Back, shorter.',
                  changelog: 'Rewritten',
                }),
              ],
              {
                audienceHistory: [
                  s.archived('2026-11-17T08:00:00Z'),
                  s.republished('2026-11-20T08:00:00Z'),
                ],
              }
            ),
          ],
          skills: [],
        })
      );

      it('shows a client its withdrawal, then its return as a creation', async () => {
        const answer = await call(await asClient(), WEEK);

        expect(summary(answer)).toEqual([
          '2026-11-17 withdrawn redaction.come-back',
          '2026-11-20 created redaction.come-back',
        ]);
        expect(answer.changes[1]).toMatchObject({
          toVersion: '1.1',
          uri: 'lepatron://expertises/redaction.come-back',
        });
      });

      it('shows the platform company its withdrawal, its reopening and its new version', async () => {
        const answer = await call(await asConsultant(), WEEK);

        expect(summary(answer)).toEqual([
          '2026-11-17 withdrawn redaction.come-back',
          '2026-11-20 updated redaction.come-back',
          '2026-11-20 opened redaction.come-back',
        ]);
      });
    });

    it('tells the platform company one opening when the history says it twice', async () => {
      harness.seed({
        ...s.SEED,
        expertises: [
          s.expertise(
            'redaction.twice',
            'Twice',
            [
              s.version('1.0', 'ACTIVE', {
                activatedAt: new Date('2026-10-01T08:00:00Z'),
              }),
            ],
            {
              audienceHistory: [
                s.opened('2026-11-17T08:00:00Z'),
                s.opened('2026-11-18T08:00:00Z'),
              ],
            }
          ),
        ],
        skills: [],
      });

      const answer = await call(await asConsultant(), WEEK);

      expect(summary(answer)).toEqual(['2026-11-17 opened redaction.twice']);
    });

    it('records the opening and the withdrawal set from an assistant', async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.PLATFORM_GROUP,
        scopes: ['mcp:read', 'skills:write'],
      });
      const audience = async (args) => {
        const first = harness.answerOf(
          await client.callTool({ name: 'set_audience', arguments: args })
        );
        return client.callTool({
          name: 'set_audience',
          arguments: { ...args, confirmation: first.confirmation },
        });
      };

      const before = new Date(Date.now() - 1000).toISOString();
      await audience({
        kind: 'expertise',
        id: 'deliverability.snds',
        audience: 'all',
      });
      const { changes } = await call(client, {
        since: before,
        change: ['opened'],
      });

      expect(changes.map((c) => c.id)).toEqual(['deliverability.snds']);
      const stored = harness
        .stored('expertises')
        .find((e) => e.expertiseId === 'deliverability.snds');
      expect(stored.audienceHistory).toHaveLength(1);
      expect(stored.audienceHistory[0].audience).toBe('all');
      expect(String(stored.audienceHistory[0]._by)).toBe(f.ALICE);
    });
  });
});

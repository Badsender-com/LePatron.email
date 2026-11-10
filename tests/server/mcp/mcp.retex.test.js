/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The retex loop (ADR 0021, epic #1472). A retex is a divergence (on a
// passage of a skill or an expertise: what it recommended, what the user
// decided, why) or a complement (what it lacked, what the user brought, where
// it comes from), never a summary of the session. A super admin's is kept
// whatever the company; anyone else's needs the company's permission and the
// user's approval. Two retex that converge make a change: the draft cites
// them, and its publication closes them. Super admins read and dismiss the
// retex of every company.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const WRITE = ['mcp:read', 'skills:write'];
const REPORT = 'report_retex';
const LIST = 'list_retex';
const DISMISS = 'dismiss_retex';
const SUBJECT_LINES = 'redaction.subject-line'; // 2.1 active, 3.0 draft
const SUBJECT_IDEAS = 'redaction.subject-ideas'; // a skill, 1.2 active

// The subject line expertise with anchored sections, as the platform writes
// them (`## [id] Title`), in its active version.
const ANCHORED_BODY =
  '## [length] Length\n\nKeep the subject under 50 characters.\n\n## [tone] Tone\n\nOne promise, no shouting.';
const SEED = {
  ...f.SEED,
  expertises: f.EXPERTISES.map((e) =>
    e.expertiseId === SUBJECT_LINES
      ? {
          ...e,
          versions: e.versions.map((v) =>
            v.status === 'ACTIVE' ? { ...v, body: ANCHORED_BODY } : v
          ),
        }
      : e
  ),
};

// A divergence on the length of a subject line.
const LENGTH_DIVERGENCE = {
  kind: 'divergence',
  about: { kind: 'expertise', id: SUBJECT_LINES },
  section: 'length',
  recommended: 'A subject under 50 characters',
  decided: 'A 62-character subject',
  why: 'In B2B, the longer subject named the product and was opened more',
};
// A complement on the same expertise.
const B2B_COMPLEMENT = {
  kind: 'complement',
  about: { kind: 'expertise', id: SUBJECT_LINES },
  section: 'length',
  missing: 'Nothing on B2B subjects',
  brought: 'In B2B, a subject naming the product outweighs its length',
  source: 'A/B tests on three B2B missions',
};
// A complement about know-how no expertise covers yet.
const ORPHAN_COMPLEMENT = {
  kind: 'complement',
  category: 'redaction',
  part: 'preheader',
  missing: 'Nothing on preheaders in Arabic',
  brought: 'An Arabic preheader is cut after about 40 characters in Gmail',
  source: 'Rendering tests on Gmail and Outlook',
};

describe('the retex loop', () => {
  beforeEach(() => harness.seed(SEED));
  afterEach(() => harness.disconnect());

  const call = async (client, name, args) =>
    harness.answerOf(await client.callTool({ name, arguments: args }));
  const toolsOf = async (client) =>
    (await client.listTools()).tools.map((t) => t.name);
  // A super admin, connected to the platform company or to a client's.
  const asConsultant = (group = f.PLATFORM_GROUP) =>
    harness.connectAs(f.ALICE, { group, scopes: WRITE });
  const asClient = () => harness.connectAs(f.FRANK);
  const allowRetex = () =>
    harness.update('groups', f.CLIENT_GROUP, { allowRetex: true });
  const listOpen = async (filters = {}) =>
    (await call(await asConsultant(), LIST, filters)).items;

  // Turned on by #1474 (report a retex, and read them)
  describe('reporting a retex', () => {
    it('records a super admin divergence on a section of an expertise', async () => {
      const answer = await call(
        await asConsultant(),
        REPORT,
        LENGTH_DIVERGENCE
      );

      expect(answer).toMatchObject({ kept: true, retexId: expect.any(String) });
      expect(await listOpen()).toEqual([
        expect.objectContaining({
          retexId: answer.retexId,
          kind: 'divergence',
          status: 'open',
          about: { kind: 'expertise', id: SUBJECT_LINES, version: '2.1' },
          section: 'length',
          recommended: LENGTH_DIVERGENCE.recommended,
          decided: LENGTH_DIVERGENCE.decided,
          why: LENGTH_DIVERGENCE.why,
          author: 'consultant',
        }),
      ]);
    });

    it('records a divergence on a skill by a quotation of its version', async () => {
      const answer = await call(await asConsultant(), REPORT, {
        kind: 'divergence',
        about: { kind: 'skill', id: SUBJECT_IDEAS },
        quote: 'each under 50 characters',
        recommended: 'Three subject lines under 50 characters',
        decided: 'One of 58 characters',
        why: 'The brand name is long',
      });

      expect(answer.kept).toBe(true);
    });

    it('records a complement about no skill or expertise, by its kind of know-how and part of the email', async () => {
      const answer = await call(
        await asConsultant(),
        REPORT,
        ORPHAN_COMPLEMENT
      );

      expect(answer.kept).toBe(true);
      expect(
        await listOpen({ category: 'redaction', part: 'preheader' })
      ).toEqual([
        expect.objectContaining({
          kind: 'complement',
          about: null,
          category: 'redaction',
          part: 'preheader',
          brought: ORPHAN_COMPLEMENT.brought,
        }),
      ]);
    });

    it('stores the part of the email trimmed and in lower case, so that two retex meet', async () => {
      await call(await asConsultant(), REPORT, {
        ...ORPHAN_COMPLEMENT,
        part: ' Preheader ',
      });

      expect(await listOpen({ part: 'PREHEADER' })).toEqual([
        expect.objectContaining({ part: 'preheader' }),
      ]);
    });

    it.each([
      [
        'a divergence without a passage',
        { ...LENGTH_DIVERGENCE, section: undefined },
        /passage|section/i,
      ],
      [
        'a divergence that decided what was recommended',
        { ...LENGTH_DIVERGENCE, decided: LENGTH_DIVERGENCE.recommended },
        /divergence/i,
      ],
      [
        'a complement that brings nothing',
        { ...B2B_COMPLEMENT, brought: '' },
        /brought/i,
      ],
      [
        'a section the version does not have',
        { ...LENGTH_DIVERGENCE, section: 'emojis' },
        /emojis/i,
      ],
      [
        'a quotation the skill does not hold',
        {
          ...LENGTH_DIVERGENCE,
          about: { kind: 'skill', id: SUBJECT_IDEAS },
          section: undefined,
          quote: 'never use capitals',
        },
        /quot/i,
      ],
      [
        'a complement about nothing, without a kind of know-how',
        { ...ORPHAN_COMPLEMENT, category: undefined },
        /category/i,
      ],
    ])('refuses %s', async (_case, retex, error) => {
      const answer = await call(await asConsultant(), REPORT, retex);

      expect(answer.error).toMatch(error);
    });

    it('refuses a retex about what the user may not read', async () => {
      const answer = await call(await asClient(), REPORT, {
        ...B2B_COMPLEMENT,
        about: { kind: 'expertise', id: 'design.dark-mode' },
        section: undefined,
      });

      expect(answer.error).toMatch(/not found/i);
    });

    it("keeps a super admin's retex in a company that does not allow retex", async () => {
      const answer = await call(
        await asConsultant(f.CLIENT_GROUP),
        REPORT,
        LENGTH_DIVERGENCE
      );

      expect(answer.kept).toBe(true);
    });

    it.each([
      ['the company does not allow retex', false, true, 'company'],
      ['the user does not approve it', true, false, 'approval'],
    ])(
      "drops a client user's retex when %s",
      async (_case, allowed, approvedByUser, reason) => {
        harness.update('groups', f.CLIENT_GROUP, { allowRetex: allowed });

        const answer = await call(await asClient(), REPORT, {
          ...LENGTH_DIVERGENCE,
          approvedByUser,
        });

        expect(answer).toEqual({ kept: false, reason });
        expect(harness.stored('retex')).toEqual([]);
      }
    );

    it("attaches a super admin's retex to the platform company, the company they connected to kept as context (ADR 0021)", async () => {
      const { retexId } = await call(
        await asConsultant(f.CLIENT_GROUP),
        REPORT,
        LENGTH_DIVERGENCE
      );

      expect(await listOpen()).toEqual([
        expect.objectContaining({
          retexId,
          author: 'consultant',
          company: { id: f.PLATFORM_GROUP, name: 'Platform' },
          connectedTo: { id: f.CLIENT_GROUP, name: 'A client' },
        }),
      ]);
    });

    it("follows the platform company's retention once a super admin's retex is closed, not the client's", async () => {
      harness.update('groups', f.PLATFORM_GROUP, { logRetentionDays: 200 });
      const { retexId } = await call(
        await asConsultant(f.CLIENT_GROUP),
        REPORT,
        LENGTH_DIVERGENCE
      );

      await call(await asConsultant(), DISMISS, {
        retexId,
        reason: 'A one-off brand constraint',
      });

      const [stored] = harness.stored('retex');
      const days = (stored.expiresAt - Date.now()) / 86400000;
      expect(Math.round(days)).toBe(200);
    });

    it("keeps a client user's retex the company allows and the user approves", async () => {
      allowRetex();

      const answer = await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      });

      expect(answer.kept).toBe(true);
      const [item] = await listOpen();
      expect(item).toMatchObject({
        author: 'client',
        company: { id: f.CLIENT_GROUP, name: 'A client' },
      });
      expect(item).not.toHaveProperty('connectedTo');
    });

    it('keeps an open retex with no expiry', async () => {
      allowRetex();
      await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      });

      expect(harness.stored('retex')).toEqual([
        expect.objectContaining({ expiresAt: null }),
      ]);
    });
  });

  // A company keeps 200 retex a day at most: a guard against an assistant
  // that runs away (ADR 0021).
  describe('the daily cap of a company', () => {
    const HOUR = 60 * 60 * 1000;
    const retexOf = (company, count, hoursAgo = 1) =>
      Array.from({ length: count }, () => ({
        ...ORPHAN_COMPLEMENT,
        _company: company,
        author: 'client',
        status: 'open',
        createdAt: new Date(Date.now() - hoursAgo * HOUR),
      }));
    const seedWith = (...retex) =>
      harness.seed({ ...SEED, retex: retex.flat() });

    it('answers that the cap is reached past 200 retex in the last 24 hours, and keeps nothing', async () => {
      seedWith(retexOf(f.CLIENT_GROUP, 200));
      allowRetex();

      const answer = await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      });

      expect(answer).toEqual({ kept: false, reason: 'limit' });
      expect(harness.stored('retex')).toHaveLength(200);
    });

    it('counts only the retex of the last 24 hours, of the same company', async () => {
      seedWith(
        retexOf(f.CLIENT_GROUP, 199),
        retexOf(f.CLIENT_GROUP, 50, 25),
        retexOf(f.OTHER_GROUP, 200)
      );
      allowRetex();

      const answer = await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      });

      expect(answer.kept).toBe(true);
    });

    it("counts a consultant's retex with the platform company's, whatever company they connected to", async () => {
      seedWith(retexOf(f.PLATFORM_GROUP, 200));

      const consultant = await call(
        await asConsultant(f.CLIENT_GROUP),
        REPORT,
        LENGTH_DIVERGENCE
      );
      allowRetex();
      const client = await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      });

      expect(consultant).toEqual({ kept: false, reason: 'limit' });
      expect(client.kept).toBe(true);
    });
  });

  // The retex are read a page at a time, filtered by the database (ADR 0021).
  describe('reading a page at a time', () => {
    const MINUTE = 60 * 1000;
    // `count` open retex of a client, the latest first, `fields` apart.
    const stored = (count, fields, from = 0) =>
      Array.from({ length: count }, (_, i) => ({
        ...LENGTH_DIVERGENCE,
        about: { ...LENGTH_DIVERGENCE.about, version: '2.1' },
        _company: f.CLIENT_GROUP,
        author: 'client',
        status: 'open',
        createdAt: new Date(Date.now() - (from + i + 1) * MINUTE),
        ...fields,
      }));
    const seedWith = (...retex) =>
      harness.seed({ ...SEED, retex: retex.flat() });
    const models = () =>
      require('../../../packages/server/common/models.common.js');

    it('lists 20 retex a page, the latest first, with the total', async () => {
      seedWith(stored(25, {}));
      const client = await asConsultant();

      const first = await call(client, LIST, {});
      const second = await call(client, LIST, { page: 2 });

      expect(first).toMatchObject({
        page: 1,
        pageSize: 20,
        total: 25,
        totalPages: 2,
      });
      expect(first.items).toHaveLength(20);
      expect(second.items).toHaveLength(5);
      const dates = [...first.items, ...second.items].map((r) => r.createdAt);
      expect(dates).toEqual([...dates].sort().reverse());
    });

    it('refuses a page of more than 50 retex', async () => {
      const answer = await call(await asConsultant(), LIST, { pageSize: 51 });

      expect(answer.error).toBeDefined();
    });

    it('answers the latest 20 candidates, says how many more, and list_retex reads them all', async () => {
      seedWith(
        stored(30, { section: 'tone', recommended: 'One promise' }),
        stored(25, {}, 30)
      );
      const client = await asConsultant();

      const answer = await call(client, REPORT, B2B_COMPLEMENT);
      const rest = await call(client, LIST, {
        convergingWith: answer.retexId,
        page: 2,
      });

      expect(answer.candidates).toHaveLength(20);
      expect(answer.moreCandidates).toBe(5);
      expect(rest).toMatchObject({ total: 25, totalPages: 2 });
      expect(rest.items).toHaveLength(5);
      [...answer.candidates, ...rest.items].forEach((candidate) =>
        expect(candidate.section).toBe('length')
      );
    });

    it('refuses to read the candidates of no retex', async () => {
      const answer = await call(await asConsultant(), LIST, {
        convergingWith: 'not-an-id',
      });

      expect(answer.error).toMatch(/no retex/i);
    });

    it('counts the open retex of the searches in the database, without reading them', async () => {
      seedWith(stored(3, {}));
      const find = jest.spyOn(models().McpRetexes, 'find');

      const { expertises } = await call(
        await asConsultant(),
        'find_applicable_expertises',
        { scope: ['subject'], categories: ['redaction'] }
      );
      find.mockRestore();

      expect(find).not.toHaveBeenCalled();
      expect(expertises).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ expertiseId: SUBJECT_LINES, openRetex: 3 }),
        ])
      );
    });
  });

  // Stopping the retex of a company erases its users' retex, open or closed
  // (ADR 0012, ADR 0021); the consultants' belong to the platform company.
  describe('the retex stopped', () => {
    const models = () =>
      require('../../../packages/server/common/models.common.js');
    const stopRetex = () => {
      harness.update('groups', f.CLIENT_GROUP, { allowRetex: false });
      return require('../../../packages/server/group/group-switch.js').forgetSwitchedOff(
        f.CLIENT_GROUP,
        { allowRetex: false }
      );
    };

    it("erases the company's client retex, open or closed, and keeps the consultants' and the other companies'", async () => {
      allowRetex();
      await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      });
      const { retexId: closed } = await call(await asClient(), REPORT, {
        ...B2B_COMPLEMENT,
        approvedByUser: true,
      });
      await call(await asConsultant(), DISMISS, {
        retexId: closed,
        reason: 'A one-off brand constraint',
      });
      const { retexId: consultant } = await call(
        await asConsultant(f.CLIENT_GROUP),
        REPORT,
        LENGTH_DIVERGENCE
      );
      const other = await models().McpRetexes.create({
        ...ORPHAN_COMPLEMENT,
        _company: f.OTHER_GROUP,
        author: 'client',
        status: 'open',
      });

      await stopRetex();
      await stopRetex();

      expect(
        harness
          .stored('retex')
          .map((r) => String(r._id))
          .sort()
      ).toEqual([consultant, String(other._id)].sort());
    });

    it('erases a client retex written while the retex was being stopped', async () => {
      allowRetex();
      const { McpRetexes } = models();
      const create = McpRetexes.create;
      const racing = jest
        .spyOn(McpRetexes, 'create')
        // The stopping runs between the check and the write.
        .mockImplementationOnce(async (record) => {
          await stopRetex();
          return create(record);
        });

      const answer = await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      });
      racing.mockRestore();

      expect(answer).toEqual({ kept: false, reason: 'company' });
      expect(harness.stored('retex')).toEqual([]);
    });
  });

  // Turned on by #1474 (report a retex, and read them)
  describe('a feedback is a rating and a comment', () => {
    it('no longer takes a summary of the session', async () => {
      allowRetex();

      const answer = await call(await asClient(), 'submit_feedback', {
        rating: 'down',
        comment: 'Too long',
        consentToRetex: true,
        sessionSummary: 'The whole session',
      });

      expect(answer).toEqual({ recorded: true });
      expect(harness.stored('feedbacks')).toEqual([
        expect.not.objectContaining({ retex: 'The whole session' }),
      ]);
    });
  });

  // Turned on by #1474 (report a retex, and read them)
  describe('reading the retex', () => {
    beforeEach(async () => {
      allowRetex();
      await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      });
      await call(
        await harness.connectAs(f.OTTO),
        REPORT,
        // Another company, which does not allow retex: dropped.
        { ...B2B_COMPLEMENT, approvedByUser: true }
      );
      await call(await asConsultant(f.OTHER_GROUP), REPORT, B2B_COMPLEMENT);
    });

    it.each([
      [
        'the platform company, with the skills:write scope',
        f.PLATFORM_GROUP,
        WRITE,
      ],
      ['the platform company, reading only', f.PLATFORM_GROUP, undefined],
      ["a client's company", f.CLIENT_GROUP, undefined],
    ])(
      'is a tool listed for a super admin connected to %s',
      async (_case, group, scopes) => {
        const client = await harness.connectAs(f.ALICE, { group, scopes });

        expect(await toolsOf(client)).toEqual(
          expect.arrayContaining([REPORT, LIST, DISMISS])
        );
      }
    );

    it.each([f.ERIN, f.TESS, f.FRANK, f.WREN, f.REX])(
      'is a tool listed for no other role, whatever the token says (%s)',
      async (userId) => {
        const client = await harness.connectAs(userId, { scopes: WRITE });

        expect(await toolsOf(client)).not.toContain(LIST);
        expect(await toolsOf(client)).not.toContain(DISMISS);
      }
    );

    it('reads the retex of every company, on a connection to the platform company', async () => {
      const { items } = await call(await asConsultant(), LIST, {});

      expect(items.map((item) => item.company.id).sort()).toEqual(
        [f.CLIENT_GROUP, f.PLATFORM_GROUP].sort()
      );
    });

    it("reads the retex of every company, as a super admin connected to a client's company without writing (ADR 0021)", async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.CLIENT_GROUP,
      });

      const { items } = await call(client, LIST, {});

      expect(items).toHaveLength(2);
    });

    it('says the company and the role of the author, never who', async () => {
      const { items } = await call(await asConsultant(), LIST, {});

      const text = JSON.stringify(items);
      expect(text).not.toContain('Frank');
      expect(text).not.toContain(f.FRANK);
      expect(text).not.toContain(f.ALICE);
      expect(items.map((item) => item.author).sort()).toEqual([
        'client',
        'consultant',
      ]);
    });

    it('filters by skill or expertise, section and kind', async () => {
      const divergences = await listOpen({
        about: { kind: 'expertise', id: SUBJECT_LINES },
        section: 'length',
        kind: 'divergence',
      });

      expect(divergences.map((item) => item.author)).toEqual(['client']);
    });

    it('refuses a super admin who no longer may manage the platform, checked again at the call', async () => {
      const client = await asConsultant();
      harness.update('users', f.ALICE, { role: 'company_admin' });

      const answer = await call(client, LIST, {});

      expect(answer.error).toMatch(/not allowed/i);
    });
  });

  // Turned on by #1475 (dismiss a retex, and the candidates of a convergence)
  describe('dismissing a retex', () => {
    let retexId;

    beforeEach(async () => {
      allowRetex();
      ({ retexId } = await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      }));
    });

    it("closes it, as a super admin connected to a client's company without writing (ADR 0021)", async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.CLIENT_GROUP,
      });

      const answer = await call(client, DISMISS, {
        retexId,
        reason: 'A one-off brand constraint',
      });

      expect(answer).toEqual({ retexId, status: 'dismissed' });
    });

    it('closes it with the reason, and leaves it readable', async () => {
      const answer = await call(await asConsultant(), DISMISS, {
        retexId,
        reason: 'A one-off brand constraint',
      });

      expect(answer).toEqual({ retexId, status: 'dismissed' });
      expect(await listOpen()).toEqual([]);
      expect(await listOpen({ status: 'dismissed' })).toEqual([
        expect.objectContaining({
          retexId,
          status: 'dismissed',
          dismissal: { reason: 'A one-off brand constraint' },
        }),
      ]);
    });

    it("starts the company's retention once dismissed", async () => {
      await call(await asConsultant(), DISMISS, {
        retexId,
        reason: 'A one-off brand constraint',
      });

      const [stored] = harness.stored('retex');
      const days = (stored.expiresAt - Date.now()) / 86400000;
      expect(Math.round(days)).toBe(30);
    });

    it('refuses an id that is no open retex', async () => {
      const answer = await call(await asConsultant(), DISMISS, {
        retexId: 'not-an-id',
        reason: 'A one-off brand constraint',
      });

      expect(answer.error).toMatch(/no open retex/i);
    });

    it('needs a reason', async () => {
      const answer = await call(await asConsultant(), DISMISS, {
        retexId,
        reason: '',
      });

      expect(answer.error).toMatch(/reason/i);
    });
  });

  // Turned on by #1475 (dismiss a retex, and the candidates of a convergence)
  describe('the candidates of a convergence', () => {
    let clientRetex;

    beforeEach(async () => {
      allowRetex();
      clientRetex = (
        await call(await asClient(), REPORT, {
          ...LENGTH_DIVERGENCE,
          approvedByUser: true,
        })
      ).retexId;
      // On another section: not a candidate.
      await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        section: 'tone',
        recommended: 'One promise',
        decided: 'Two promises',
        approvedByUser: true,
      });
    });

    it('answers a super admin the open retex on the same passage', async () => {
      const answer = await call(await asConsultant(), REPORT, B2B_COMPLEMENT);

      expect(answer.candidates.map((c) => c.retexId)).toEqual([clientRetex]);
    });

    it('leaves out a dismissed retex', async () => {
      await call(await asConsultant(), DISMISS, {
        retexId: clientRetex,
        reason: 'A one-off brand constraint',
      });

      const answer = await call(await asConsultant(), REPORT, B2B_COMPLEMENT);

      expect(answer.candidates).toEqual([]);
    });

    it('matches complements about nothing by kind of know-how and part of the email', async () => {
      const first = await call(await asConsultant(), REPORT, ORPHAN_COMPLEMENT);

      const second = await call(await asConsultant(), REPORT, {
        ...ORPHAN_COMPLEMENT,
        brought: 'Keep an Arabic preheader under 40 characters',
      });

      expect(second.candidates.map((c) => c.retexId)).toEqual([first.retexId]);
    });

    it.each([
      ['the platform company, reading only', f.PLATFORM_GROUP],
      ["a client's company", f.CLIENT_GROUP],
    ])(
      'answers the candidates to a super admin connected to %s (ADR 0021)',
      async (_case, group) => {
        const client = await harness.connectAs(f.ALICE, { group });

        const answer = await call(client, REPORT, B2B_COMPLEMENT);

        expect(answer.candidates.map((c) => c.retexId)).toEqual([clientRetex]);
      }
    );

    it('meets, on a section, the complements of the same expertise that name no passage, both ways', async () => {
      const noPassage = await call(await asConsultant(), REPORT, {
        ...B2B_COMPLEMENT,
        section: undefined,
      });

      const onSection = await call(await asConsultant(), REPORT, {
        ...LENGTH_DIVERGENCE,
        decided: 'A 70-character subject',
      });

      expect(noPassage.candidates.map((c) => c.retexId).sort()).toEqual(
        expect.arrayContaining([clientRetex])
      );
      expect(onSection.candidates.map((c) => c.retexId)).toEqual(
        expect.arrayContaining([clientRetex, noPassage.retexId])
      );
    });

    it('meets quotations of a skill that overlap, whatever their spacing and case', async () => {
      const skillDivergence = {
        kind: 'divergence',
        about: { kind: 'skill', id: SUBJECT_IDEAS },
        recommended: 'Under 50 characters',
        decided: 'Over 50 characters',
        why: 'A long brand name',
      };
      const first = await call(await asConsultant(), REPORT, {
        ...skillDivergence,
        quote: 'each under 50 characters',
      });

      const second = await call(await asConsultant(), REPORT, {
        ...skillDivergence,
        quote: 'Give three subject lines,   EACH under 50 characters',
      });

      expect(second.candidates.map((c) => c.retexId)).toEqual([first.retexId]);
    });

    it('keeps complements about nothing apart from those about a skill or an expertise', async () => {
      await call(await asConsultant(), REPORT, {
        ...B2B_COMPLEMENT,
        section: undefined,
      });

      const orphan = await call(await asConsultant(), REPORT, {
        ...ORPHAN_COMPLEMENT,
        part: 'subject',
      });

      expect(orphan.candidates).toEqual([]);
    });

    it('gives a client user no candidates', async () => {
      const answer = await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      });

      expect(answer).not.toHaveProperty('candidates');
    });
  });

  // Turned on by #1476 (a draft cites the retex, its publication closes them)
  describe('a draft cites the retex it addresses', () => {
    let ids;

    beforeEach(async () => {
      allowRetex();
      const first = await call(await asClient(), REPORT, {
        ...LENGTH_DIVERGENCE,
        approvedByUser: true,
      });
      const second = await call(await asConsultant(), REPORT, B2B_COMPLEMENT);
      ids = [first.retexId, second.retexId];
    });

    const proposeWith = async (addressesRetex) =>
      call(await asConsultant(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body:
          '## [length] Length\n\nUnder 50 characters, unless a B2B subject names the product.',
        changelog: 'B2B subjects may name the product',
        addressesRetex,
      });

    it('records the retex in the draft', async () => {
      const answer = await proposeWith(ids);

      expect(answer).toMatchObject({ version: '3.0', addressesRetex: ids });
    });

    it('refuses a retex that does not exist or is closed', async () => {
      await call(await asConsultant(), DISMISS, {
        retexId: ids[0],
        reason: 'A one-off brand constraint',
      });

      const answer = await proposeWith(ids);

      expect(answer.error).toMatch(/^MCP_RETEX_NOT_OPEN /);
      expect(answer.error).toMatch(new RegExp(ids[0]));
      expect(answer.error).not.toMatch(new RegExp(ids[1]));
    });

    it('closes them when the draft is published from an assistant', async () => {
      await proposeWith(ids);
      const client = await asConsultant();
      // A major needs its changelog and release notes, from the check on
      // (ADR 0019).
      const draft = {
        kind: 'expertise',
        id: SUBJECT_LINES,
        changelog: 'B2B subjects may name the product',
        releaseNotes: 'A B2B subject may name the product.',
      };
      const { confirmation } = await call(client, 'publish_draft', draft);

      await call(client, 'publish_draft', { ...draft, confirmation });

      expect(await listOpen()).toEqual([]);
      // The latest first.
      expect(await listOpen({ status: 'addressed' })).toEqual(
        [...ids].reverse().map((retexId) =>
          expect.objectContaining({
            retexId,
            status: 'addressed',
            addressedIn: {
              kind: 'expertise',
              id: SUBJECT_LINES,
              version: '3.0',
            },
          })
        )
      );
    });
  });

  // Turned on by #1476 (a draft cites the retex, its publication closes them)
  describe('a publication closes the retex', () => {
    let ids;
    let publication;
    let expertiseService;

    beforeAll(() => {
      // Not at the top of the file: required once the models are the
      // stand-ins of the harness.
      publication = require('../../../packages/server/ai-skill/services/skills-publication.service.js');
      expertiseService = require('../../../packages/server/ai-skill/services/expertise.service.js');
    });

    beforeEach(async () => {
      const first = await call(await asConsultant(), REPORT, LENGTH_DIVERGENCE);
      const second = await call(await asConsultant(), REPORT, B2B_COMPLEMENT);
      ids = [first.retexId, second.retexId];
      await call(await asConsultant(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body:
          '## [length] Length\n\nUnder 50 characters, unless a B2B subject names the product.',
        changelog: 'B2B subjects may name the product',
        addressesRetex: ids,
      });
    });

    it('closes them when the draft is published from the back office', async () => {
      await publication.publishVersion(
        {
          kind: 'expertise',
          id: SUBJECT_LINES,
          version: { major: 3, minor: 0 },
          payload: { changelog: 'B2B', releaseNotes: 'B2B subjects' },
        },
        { id: f.ALICE }
      );

      expect(await listOpen({ status: 'addressed' })).toHaveLength(2);
      harness
        .stored('retex')
        .forEach((retex) =>
          expect(new Date(retex.expiresAt).getTime()).toBeGreaterThan(
            Date.now()
          )
        );
    });

    it('names the item and the version that addressed it, another than the retex is about (ADR 0021)', async () => {
      const { retexId } = await call(await asConsultant(), REPORT, {
        kind: 'divergence',
        about: { kind: 'skill', id: SUBJECT_IDEAS },
        quote: 'each under 50 characters',
        recommended: 'Three subject lines under 50 characters',
        decided: 'One of 58 characters',
        why: 'The brand name is long',
      });
      await call(await asConsultant(), 'propose_expertise_change', {
        expertiseId: SUBJECT_LINES,
        body: '## [length] Length\n\nUnder 60 characters for a long brand.',
        changelog: 'A long brand name',
        addressesRetex: [retexId],
      });

      await publication.publishVersion(
        {
          kind: 'expertise',
          id: SUBJECT_LINES,
          version: { major: 3, minor: 0 },
          payload: { changelog: 'B2B', releaseNotes: 'B2B subjects' },
        },
        { id: f.ALICE }
      );

      const [item] = await listOpen({
        status: 'addressed',
        about: { kind: 'skill', id: SUBJECT_IDEAS },
      });
      expect(item).toMatchObject({
        retexId,
        about: { kind: 'skill', id: SUBJECT_IDEAS },
        addressedIn: { kind: 'expertise', id: SUBJECT_LINES, version: '3.0' },
      });
    });

    it('still publishes when closing the retex fails', async () => {
      const {
        McpRetexes,
      } = require('../../../packages/server/common/models.common.js');
      const find = jest.spyOn(McpRetexes, 'find').mockImplementationOnce(() => {
        throw new Error('The database is away');
      });

      const { doc } = await publication.publishVersion(
        {
          kind: 'expertise',
          id: SUBJECT_LINES,
          version: { major: 3, minor: 0 },
          payload: { changelog: 'B2B', releaseNotes: 'B2B subjects' },
        },
        { id: f.ALICE }
      );
      find.mockRestore();

      expect(doc.activeVersion).toEqual({ major: 3, minor: 0 });
      expect(await listOpen()).toHaveLength(2);
    });

    it('takes no citation from the back office’s update of a draft', async () => {
      const { retexId } = await call(await asConsultant(), REPORT, {
        ...LENGTH_DIVERGENCE,
        decided: 'A 75-character subject',
      });
      await expertiseService.updateVersion(
        SUBJECT_LINES,
        { major: 3, minor: 0 },
        { retexIds: [retexId] },
        f.ALICE
      );

      await publication.publishVersion(
        {
          kind: 'expertise',
          id: SUBJECT_LINES,
          version: { major: 3, minor: 0 },
          payload: { changelog: 'B2B', releaseNotes: 'B2B subjects' },
        },
        { id: f.ALICE }
      );

      expect((await listOpen()).map((item) => item.retexId)).toEqual([retexId]);
    });

    it('keeps the citations of two proposals written at once', async () => {
      const cite = async (decided) => {
        const { retexId } = await call(await asConsultant(), REPORT, {
          ...LENGTH_DIVERGENCE,
          decided,
        });
        return retexId;
      };
      const [first, second] = [
        await cite('A 75-character subject'),
        await cite('An 80-character subject'),
      ];

      await Promise.all([
        expertiseService.citeRetex(
          SUBJECT_LINES,
          { major: 3, minor: 0 },
          [first],
          f.ALICE
        ),
        expertiseService.citeRetex(
          SUBJECT_LINES,
          { major: 3, minor: 0 },
          [second, ids[0]],
          f.ALICE
        ),
      ]);

      const draft = harness
        .stored('expertises')
        .find((e) => e.expertiseId === SUBJECT_LINES)
        .versions.find((v) => v.versionMajor === 3);
      expect([...draft.retexIds].sort()).toEqual(
        [...ids, first, second].sort()
      );
    });

    it('cites nothing on a version that is no longer a draft', async () => {
      const { retexId } = await call(await asConsultant(), REPORT, {
        ...LENGTH_DIVERGENCE,
        decided: 'A 75-character subject',
      });

      await expect(
        expertiseService.citeRetex(
          SUBJECT_LINES,
          { major: 2, minor: 1 },
          [retexId],
          f.ALICE
        )
      ).rejects.toMatchObject({ status: 409 });
    });

    it('leaves them open when the draft is deleted', async () => {
      await expertiseService.deleteVersion(SUBJECT_LINES, {
        major: 3,
        minor: 0,
      });

      expect((await listOpen()).map((item) => item.retexId).sort()).toEqual(
        [...ids].sort()
      );
    });
  });

  // Turned on by #1477 (the open retex of a read, and the instructions)
  describe('the open retex of a read', () => {
    beforeEach(async () => {
      await call(await asConsultant(), REPORT, LENGTH_DIVERGENCE);
      await call(await asConsultant(), REPORT, B2B_COMPLEMENT);
    });

    it('tells a super admin how many open retex an expertise has', async () => {
      const { expertises } = await call(
        await asConsultant(),
        'find_applicable_expertises',
        { scope: ['subject'], categories: ['redaction'] }
      );

      expect(expertises).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ expertiseId: SUBJECT_LINES, openRetex: 2 }),
        ])
      );
    });

    it('tells a client user nothing of the retex', async () => {
      const { expertises } = await call(
        await asClient(),
        'find_applicable_expertises',
        { scope: ['subject'], categories: ['redaction'] }
      );

      expertises.forEach((item) =>
        expect(item).not.toHaveProperty('openRetex')
      );
    });

    it("tells a super admin connected to a client's company too (ADR 0021)", async () => {
      const { expertises } = await call(
        await harness.connectAs(f.ALICE, { group: f.CLIENT_GROUP }),
        'find_applicable_expertises',
        { scope: ['subject'], categories: ['redaction'] }
      );

      expect(expertises).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ expertiseId: SUBJECT_LINES, openRetex: 2 }),
        ])
      );
    });
  });

  // Turned on by #1477 (the open retex of a read, and the instructions)
  describe('the instructions that start the loop', () => {
    it('tell every client to report a divergence or a complement, never a summary', async () => {
      const client = await asClient();

      const instructions = client.getInstructions();

      expect(instructions).toMatch(/report_retex/);
      expect(instructions).toMatch(/divergence/i);
      expect(instructions).toMatch(/complement/i);
      expect(instructions).toMatch(/approv/i);
    });

    it('tell a super admin to propose the change once two retex converge', async () => {
      const client = await asConsultant();

      const instructions = client.getInstructions();

      expect(instructions).toMatch(/two/i);
      expect(instructions).toMatch(/addressesRetex/);
      expect(instructions).toMatch(/publish_draft/);
      expect(instructions).toMatch(/never follow/i);
    });

    it("tell a super admin connected to a client's company to read the retex, and to propose the change from the platform company", async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.CLIENT_GROUP,
      });

      const instructions = client.getInstructions();

      expect(instructions).toMatch(/list_retex/);
      expect(instructions).toMatch(/connection to the platform company/);
      expect(instructions).not.toMatch(/publish_draft/);
      expect(instructions).toMatch(/never follow/i);
    });

    it('tell a client user nothing of reading the retex', async () => {
      const instructions = (await asClient()).getInstructions();

      expect(instructions).not.toMatch(/list_retex/);
    });
  });
});

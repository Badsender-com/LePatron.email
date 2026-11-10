/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Publishing what a feature uses is guarded (ADR 0019, epic #1421). LePatron
// works out which skills and expertises a feature uses from the features'
// own declarations. Publishing a version one uses first replays the test
// cases of the feature skills concerned, with the active version and with
// the new one, and shows both; the person decides, a failure warns without
// blocking. The AI provider is simulated: it answers which version reached
// its prompt.

const { createMcpStore } = require('../../helpers/mcp-fake-models');

const store = createMcpStore();
jest.doMock(
  '../../../packages/server/common/models.common.js',
  () => store.models
);
jest.doMock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// A feature, as a skill manifest declares it: subject line generation calls
// two feature skills and loads the redaction expertises of the subject.
const SUBJECT_IDEAS = 'redaction.subject-ideas';
const PREHEADER_IDEAS = 'redaction.preheader-ideas';
const SUBJECT_FEATURE = {
  featureType: 'subject_generation',
  description: 'Subject line generation',
  usedSkills: [SUBJECT_IDEAS, PREHEADER_IDEAS],
  usedExpertise: [],
  expertiseFilters: [{ scope: ['subject'], categories: ['redaction'] }],
};
jest.doMock(
  '../../../packages/server/ai-skill/services/manifest-registry.js',
  () => ({
    ...jest.requireActual(
      '../../../packages/server/ai-skill/services/manifest-registry.js'
    ),
    listManifests: () => [SUBJECT_FEATURE],
  })
);

// The AI engine of the platform company, and a provider that says which
// version of the expertise and of the skill reached its prompt.
const ACTIVE_RULE = 'Keep the subject under 50 characters.';
const DRAFT_RULE = 'Keep the subject under 40 characters.';
const ACTIVE_BODY = 'Give three subject lines, each under 50 characters.';
const DRAFT_BODY = 'Give five subject lines, each under 40 characters.';
const provider = { chatComplete: jest.fn() };
jest.doMock(
  '../../../packages/server/integration-providers/provider-factory.js',
  () => ({ createProvider: () => provider })
);
jest.doMock(
  '../../../packages/server/ai-feature/ai-feature.service.js',
  () => ({
    FeatureResolutionReasons: {},
    resolveActiveFeature: jest.fn(async () => ({
      ok: true,
      feature: {
        featureType: 'skill',
        isActive: true,
        config: { model: 'a-model' },
      },
      integration: { _id: 'integration-1', provider: 'openai', isActive: true },
    })),
  })
);
const answerWithWhatReachedIt = () =>
  provider.chatComplete.mockImplementation(async ({ messages }) => {
    const prompt = messages.map((m) => m.content).join('\n');
    const expertise = prompt.includes(DRAFT_RULE)
      ? 'draft expertise'
      : prompt.includes(ACTIVE_RULE)
      ? 'active expertise'
      : 'no expertise';
    const skill = prompt.includes(DRAFT_BODY) ? 'draft skill' : 'active skill';
    return { content: JSON.stringify({ text: `${expertise}, ${skill}` }) };
  });

const f = require('../../helpers/mcp-fixtures');

const SUBJECT_LINES = 'redaction.subject-line';
const SPAM_WORDS = 'deliverability.spam-words'; // no feature loads it
const ALICE = { id: f.ALICE, name: 'Alice', role: 'super_admin' };
const CASE = { name: 'A sale', input: { prompt: 'Winter sale', context: '' } };

const subjectLines = {
  ...f.EXPERTISES[0],
  activeVersion: { major: 2, minor: 1 },
  versions: [
    {
      versionMajor: 2,
      versionMinor: 1,
      status: 'ACTIVE',
      body: `## [length] Length\n\n${ACTIVE_RULE}`,
      examplesGood: [],
      examplesBad: [],
    },
    {
      versionMajor: 2,
      versionMinor: 2,
      status: 'DRAFT',
      body: `## [length] Length\n\n${DRAFT_RULE}`,
      examplesGood: [],
      examplesBad: [],
      changelog: 'Shorter',
      releaseNotes: '',
    },
  ],
};
// A skill that reads expertises says where they go in its input.
const READS_EXPERTISE = 'Brief: {{input.prompt}}\nRules: {{input.expertise}}';
const subjectIdeas = {
  ...f.SKILLS[0],
  activeVersion: { major: 1, minor: 2 },
  versions: [
    {
      ...f.SKILLS[0].versions[0],
      inputTemplate: READS_EXPERTISE,
      skillBody: ACTIVE_BODY,
      testCases: [CASE],
    },
    {
      ...f.SKILLS[0].versions[0],
      inputTemplate: READS_EXPERTISE,
      versionMinor: 3,
      status: 'DRAFT',
      skillBody: DRAFT_BODY,
      testCases: [CASE],
      changelog: 'Five',
      releaseNotes: '',
    },
  ],
};
const preheaderIdeas = {
  ...f.SKILLS[0],
  _id: '507f1f77bcf86cd799439905',
  skillId: PREHEADER_IDEAS,
  title: 'Preheader ideas',
  versions: [{ ...f.SKILLS[0].versions[0], testCases: [] }],
};
const SEED = {
  ...f.SEED,
  expertises: [subjectLines, f.EXPERTISES[1]],
  skills: [subjectIdeas, preheaderIdeas],
};

const versionOf = (collection, idField, id, major, minor) =>
  store
    .stored(collection)
    .find((doc) => doc[idField] === id)
    .versions.find((v) => v.versionMajor === major && v.versionMinor === minor);

describe('publishing what a feature uses', () => {
  let publication;
  let featureUse;
  let batch;

  beforeAll(() => {
    publication = require('../../../packages/server/ai-skill/services/skills-publication.service');
    featureUse = require('../../../packages/server/ai-skill/services/feature-use');
    batch = require('../../../packages/server/ai-skill/services/publication-batch');
  });

  beforeEach(() => {
    store.seed(SEED);
    provider.chatComplete.mockReset();
    answerWithWhatReachedIt();
  });

  // Turned on by #1428 (used by a feature, worked out and shown)
  describe('used by a feature', () => {
    it('is said of an expertise a feature loads through its declared filters', async () => {
      expect(
        await featureUse.usedByFeatures({
          kind: 'expertise',
          id: SUBJECT_LINES,
        })
      ).toEqual([
        {
          featureType: 'subject_generation',
          description: 'Subject line generation',
        },
      ]);
    });

    it('is said of a skill a feature calls', async () => {
      expect(
        await featureUse.usedByFeatures({ kind: 'skill', id: PREHEADER_IDEAS })
      ).toEqual([
        expect.objectContaining({ featureType: 'subject_generation' }),
      ]);
    });

    it('is not said of what no feature uses', async () => {
      expect(
        await featureUse.usedByFeatures({ kind: 'expertise', id: SPAM_WORDS })
      ).toEqual([]);
    });

    // A feature loads only active expertises, and calls no archived skill.
    it('is not said of an archived expertise, even one the filters match', async () => {
      const oldRules = f.EXPERTISES.find((e) => e.status === 'ARCHIVED');
      store.seed({ ...SEED, expertises: [...SEED.expertises, oldRules] });

      expect(
        await featureUse.usedByFeatures({
          kind: 'expertise',
          id: oldRules.expertiseId,
        })
      ).toEqual([]);
    });

    it('is not said of an archived skill a feature still names', async () => {
      store.seed({
        ...SEED,
        skills: [subjectIdeas, { ...preheaderIdeas, status: 'ARCHIVED' }],
      });

      expect(
        await featureUse.usedByFeatures({ kind: 'skill', id: PREHEADER_IDEAS })
      ).toEqual([]);
    });

    // The back office pages its lists: the filter must reach past a page.
    describe('as a filter of the lists', () => {
      let skillService;
      let expertiseService;
      const UNUSED_SKILL = {
        ...f.SKILLS[1],
        updatedAt: new Date('2099-01-01'),
      };

      beforeAll(() => {
        skillService = require('../../../packages/server/ai-skill/services/skill.service');
        expertiseService = require('../../../packages/server/ai-skill/services/expertise.service');
      });

      it('keeps the skills a feature uses, past the first page', async () => {
        store.seed({ ...SEED, skills: [...SEED.skills, UNUSED_SKILL] });

        const firstPage = await skillService.listSkills({
          usedByFeature: 'true',
          pageSize: 1,
        });

        expect(firstPage.total).toBe(2);
        expect([SUBJECT_IDEAS, PREHEADER_IDEAS]).toContain(
          firstPage.items[0].skillId
        );
      });

      it('keeps the expertises a feature uses, and no archived one', async () => {
        store.seed({ ...SEED, expertises: f.EXPERTISES });

        const list = await expertiseService.listExpertise({
          usedByFeature: 'true',
        });

        expect(list.items.map((e) => e.expertiseId)).toEqual([SUBJECT_LINES]);
        expect(list.total).toBe(1);
      });

      it('keeps, of the expertises named, those a feature uses', async () => {
        store.seed({ ...SEED, expertises: f.EXPERTISES });

        const list = await expertiseService.listExpertise({
          usedByFeature: 'true',
          ids: [SUBJECT_LINES, SPAM_WORDS],
        });

        expect(list.items.map((e) => e.expertiseId)).toEqual([SUBJECT_LINES]);
      });

      it('keeps everything when it is off', async () => {
        store.seed({ ...SEED, skills: [...SEED.skills, UNUSED_SKILL] });

        expect((await skillService.listSkills({})).total).toBe(3);
      });
    });
  });

  // Turned on by #1430 (the guard on a publication)
  describe('the guard', () => {
    it('has nothing to replay for a version no feature uses', async () => {
      const guard = await publication.guardPublication({
        kind: 'expertise',
        id: SPAM_WORDS,
        version: { major: 1, minor: 0 },
      });

      expect(guard).toEqual({ usedBy: [], calls: 0, cases: [], missing: [] });
      expect(provider.chatComplete).not.toHaveBeenCalled();
    });

    it('replays the cases of the feature skills an expertise reaches, with the active version and the new one', async () => {
      const guard = await publication.guardPublication({
        kind: 'expertise',
        id: SUBJECT_LINES,
        version: { major: 2, minor: 2 },
      });

      expect(guard.calls).toBe(2);
      expect(guard.cases).toEqual([
        expect.objectContaining({
          skillId: SUBJECT_IDEAS,
          name: 'A sale',
          before: { output: { text: 'active expertise, active skill' } },
          after: { output: { text: 'draft expertise, active skill' } },
          contract: { before: true, after: true },
        }),
      ]);
    });

    it("replays a feature skill's own cases when the skill is published", async () => {
      const guard = await publication.guardPublication({
        kind: 'skill',
        id: SUBJECT_IDEAS,
        version: { major: 1, minor: 3 },
      });

      expect(guard.cases).toEqual([
        expect.objectContaining({
          before: { output: { text: 'active expertise, active skill' } },
          after: { output: { text: 'active expertise, draft skill' } },
        }),
      ]);
    });

    it('names the feature skills concerned that have no test case', async () => {
      const guard = await publication.guardPublication({
        kind: 'expertise',
        id: SUBJECT_LINES,
        version: { major: 2, minor: 2 },
      });

      expect(guard.missing).toEqual([PREHEADER_IDEAS]);
    });

    it('flags an output that breaks the contract, and an error, without stopping', async () => {
      provider.chatComplete.mockImplementation(async ({ messages }) => {
        const prompt = messages.map((m) => m.content).join('\n');
        if (prompt.includes(DRAFT_RULE)) {
          return {
            content: JSON.stringify({ subjects: ['not the contract'] }),
          };
        }
        return { content: JSON.stringify({ text: 'fine' }) };
      });

      const guard = await publication.guardPublication({
        kind: 'expertise',
        id: SUBJECT_LINES,
        version: { major: 2, minor: 2 },
      });

      expect(guard.cases[0].contract).toEqual({ before: true, after: false });

      provider.chatComplete.mockRejectedValue(new Error('provider down'));
      const failing = await publication.guardPublication({
        kind: 'expertise',
        id: SUBJECT_LINES,
        version: { major: 2, minor: 2 },
      });
      expect(failing.cases[0].after).toEqual({ error: expect.any(String) });
    });

    it('publishes a version no feature uses at once', async () => {
      store.seed({
        ...SEED,
        expertises: [
          subjectLines,
          {
            ...f.EXPERTISES[1],
            versions: [
              ...f.EXPERTISES[1].versions,
              {
                versionMajor: 1,
                versionMinor: 1,
                status: 'DRAFT',
                body: '## [words] Words\n\nNew.',
                examplesGood: [],
                examplesBad: [],
              },
            ],
          },
        ],
      });

      await publication.publishVersion(
        { kind: 'expertise', id: SPAM_WORDS, version: { major: 1, minor: 1 } },
        ALICE
      );

      expect(
        versionOf('expertises', 'expertiseId', SPAM_WORDS, 1, 1).status
      ).toBe('ACTIVE');
    });

    it('refuses to publish a version a feature uses before its guard has run', async () => {
      await expect(
        publication.publishVersion(
          {
            kind: 'expertise',
            id: SUBJECT_LINES,
            version: { major: 2, minor: 2 },
          },
          ALICE
        )
      ).rejects.toMatchObject({ status: 409 });
    });

    it('publishes after the guard, and records it with its outcome', async () => {
      const guard = await publication.guardPublication({
        kind: 'expertise',
        id: SUBJECT_LINES,
        version: { major: 2, minor: 2 },
      });

      await publication.publishVersion(
        {
          kind: 'expertise',
          id: SUBJECT_LINES,
          version: { major: 2, minor: 2 },
          guard,
        },
        ALICE
      );

      const published = versionOf(
        'expertises',
        'expertiseId',
        SUBJECT_LINES,
        2,
        2
      );
      expect(published.status).toBe('ACTIVE');
      expect(published.guardHistory).toEqual([
        expect.objectContaining({
          decision: 'published',
          by: f.ALICE,
          cases: 1,
          failed: 0,
          missing: [PREHEADER_IDEAS],
        }),
      ]);
    });

    // The opening a publication asks for (ADR 0013) is the same past the
    // guard.
    it('publishes a skill after its guard with the opening asked for', async () => {
      store.seed({
        ...SEED,
        skills: [{ ...subjectIdeas, audience: 'platform' }, preheaderIdeas],
      });
      const version = { major: 1, minor: 3 };
      const guard = await publication.guardPublication({
        kind: 'skill',
        id: SUBJECT_IDEAS,
        version,
      });

      const { doc, warnings } = await publication.publishVersion(
        {
          kind: 'skill',
          id: SUBJECT_IDEAS,
          version,
          guard,
          payload: { changelog: 'Five', openToAll: true },
        },
        ALICE
      );

      expect(doc.audience).toBe('all');
      expect(warnings).toEqual([]);
      expect(
        store.stored('skills').find((s) => s.skillId === SUBJECT_IDEAS).audience
      ).toBe('all');
    });

    it('records a cancellation, and publishes nothing', async () => {
      const guard = await publication.guardPublication({
        kind: 'expertise',
        id: SUBJECT_LINES,
        version: { major: 2, minor: 2 },
      });

      await publication.cancelPublication(
        {
          kind: 'expertise',
          id: SUBJECT_LINES,
          version: { major: 2, minor: 2 },
          guard,
        },
        ALICE
      );

      const draft = versionOf('expertises', 'expertiseId', SUBJECT_LINES, 2, 2);
      expect(draft.status).toBe('DRAFT');
      expect(draft.guardHistory).toEqual([
        expect.objectContaining({ decision: 'cancelled', by: f.ALICE }),
      ]);
    });
  });

  // Turned on by #1431 (publishing several drafts at once)
  describe('several drafts at once', () => {
    const BOTH = [
      { kind: 'expertise', id: SUBJECT_LINES, version: { major: 2, minor: 2 } },
      { kind: 'skill', id: SUBJECT_IDEAS, version: { major: 1, minor: 3 } },
    ];

    it('runs one guard over everything they touch', async () => {
      const guard = await batch.guardMany(BOTH);

      expect(guard.cases).toHaveLength(1);
      expect(guard.cases[0].after).toEqual({
        output: { text: 'draft expertise, draft skill' },
      });
      expect(guard.calls).toBe(2);
    });

    it('publishes them all after that guard, and reports each one', async () => {
      const guard = await batch.guardMany(BOTH);

      const report = await batch.publishMany(BOTH, { guard }, ALICE);

      expect(report.published.map((p) => p.id)).toEqual([
        SUBJECT_LINES,
        SUBJECT_IDEAS,
      ]);
      expect(versionOf('skills', 'skillId', SUBJECT_IDEAS, 1, 3).status).toBe(
        'ACTIVE'
      );
    });

    // As on its own page (ADR 0013): a task skill's consumed expertise that
    // is not published is warned of, without stopping the publication.
    it("reports what a skill's publication warns of", async () => {
      const DARK_MODE = 'design.dark-mode'; // never published
      store.seed({
        ...SEED,
        expertises: [...SEED.expertises, f.EXPERTISES[2]],
        skills: [
          ...SEED.skills,
          {
            _id: '507f1f77bcf86cd799439906',
            skillId: 'redaction.audit',
            title: 'Audit',
            category: 'redaction',
            status: 'DRAFT',
            audience: 'platform',
            activeVersion: { major: null, minor: 0 },
            versions: [
              {
                versionMajor: 1,
                versionMinor: 0,
                status: 'DRAFT',
                nature: 'task',
                procedure: '## Steps',
                consumedExpertiseIds: [DARK_MODE],
                changelog: 'First',
                releaseNotes: 'First',
              },
            ],
          },
        ],
      });

      const report = await batch.publishMany(
        [
          {
            kind: 'skill',
            id: 'redaction.audit',
            version: { major: 1, minor: 0 },
          },
        ],
        {},
        ALICE
      );

      expect(report.published).toEqual([
        expect.objectContaining({
          id: 'redaction.audit',
          warnings: [
            {
              code: 'CONSUMED_EXPERTISES_NOT_PUBLISHED',
              expertiseIds: [DARK_MODE],
            },
          ],
        }),
      ]);
    });

    it('goes on when one fails, and says why', async () => {
      const guard = await batch.guardMany(BOTH);

      const report = await batch.publishMany(
        [
          ...BOTH,
          {
            kind: 'expertise',
            id: SPAM_WORDS,
            version: { major: 9, minor: 0 },
          },
        ],
        { guard },
        ALICE
      );

      expect(report.failed).toEqual([
        expect.objectContaining({
          id: SPAM_WORDS,
          reason: 'not_found',
          message: expect.any(String),
        }),
      ]);
      expect(report.published).toHaveLength(2);
    });

    it('refuses, item by item, a draft a feature uses without the guard', async () => {
      const report = await batch.publishMany(BOTH, {}, ALICE);

      expect(report.failed.map((f) => f.reason)).toEqual([
        'guard_required',
        'guard_required',
      ]);
      expect(
        versionOf('expertises', 'expertiseId', SUBJECT_LINES, 2, 2).status
      ).toBe('DRAFT');
    });

    // A draft written since the plan read it, by an assistant or another
    // person, is not published (ADR 0014); the others are.
    it('leaves out a draft written since the plan read it, and says so', async () => {
      const readAt = new Date('2026-11-04T10:00:00.000Z');
      store.seed({
        ...SEED,
        expertises: [
          {
            ...subjectLines,
            versions: subjectLines.versions.map((v) =>
              v.status === 'DRAFT'
                ? { ...v, updatedAt: new Date('2026-11-04T11:00:00.000Z') }
                : v
            ),
          },
          f.EXPERTISES[1],
        ],
      });
      const guard = await batch.guardMany(BOTH);
      const [lines, ideas] = BOTH;

      const report = await batch.publishMany(
        [{ ...lines, readAt: readAt.toISOString() }, ideas],
        { guard },
        ALICE
      );

      expect(report.failed).toEqual([
        expect.objectContaining({ id: SUBJECT_LINES, reason: 'draft_changed' }),
      ]);
      expect(report.published.map((p) => p.id)).toEqual([SUBJECT_IDEAS]);
      expect(
        versionOf('expertises', 'expertiseId', SUBJECT_LINES, 2, 2).status
      ).toBe('DRAFT');
    });

    it('records the decision on each draft', async () => {
      const guard = await batch.guardMany(BOTH);

      await batch.publishMany(BOTH, { guard }, ALICE);

      expect(
        versionOf('skills', 'skillId', SUBJECT_IDEAS, 1, 3).guardHistory
      ).toEqual([expect.objectContaining({ decision: 'published' })]);
    });

    it('takes the one draft of each item, and says why it leaves one out', async () => {
      store.seed({
        ...SEED,
        skills: [
          subjectIdeas,
          {
            ...preheaderIdeas,
            versions: [
              ...preheaderIdeas.versions,
              { ...subjectIdeas.versions[1], versionMinor: 4 },
              { ...subjectIdeas.versions[1], versionMajor: 2, versionMinor: 0 },
            ],
          },
        ],
      });

      const { targets, skipped } = await batch.draftsToPublish([
        { kind: 'expertise', id: SUBJECT_LINES },
        { kind: 'skill', id: SUBJECT_IDEAS },
        { kind: 'skill', id: PREHEADER_IDEAS },
        { kind: 'expertise', id: SPAM_WORDS },
        { kind: 'skill', id: 'qc.nowhere' },
      ]);

      expect(targets).toEqual(BOTH);
      expect(
        (
          await batch.draftsToPublish([
            {
              kind: 'expertise',
              id: SUBJECT_LINES,
              updatedAt: '2026-11-04T10:00:00.000Z',
            },
          ])
        ).targets[0].readAt
      ).toBe('2026-11-04T10:00:00.000Z');
      expect(skipped).toEqual([
        { kind: 'skill', id: PREHEADER_IDEAS, reason: 'several_drafts' },
        { kind: 'expertise', id: SPAM_WORDS, reason: 'no_draft' },
        { kind: 'skill', id: 'qc.nowhere', reason: 'not_found' },
      ]);
    });

    it('says what the one guard would replay, without calling the AI', async () => {
      const plan = await batch.planMany(BOTH);

      expect(plan).toEqual({
        usedBy: [
          {
            featureType: 'subject_generation',
            description: 'Subject line generation',
          },
        ],
        calls: 2,
        missing: [PREHEADER_IDEAS],
      });
      expect(provider.chatComplete).not.toHaveBeenCalled();
    });
  });
});

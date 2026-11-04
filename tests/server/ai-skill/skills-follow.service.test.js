/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A copy follows production (ADR 0019, epic #1420). Production is the source
// of skills and expertises; a copy (staging, development) applies what
// production answers: active arrives active, a draft as a draft, with the
// audience and the served-to-assistants mark. What exists only on the copy
// stays, a newer local draft is never overwritten, no version goes back. One
// store stands for both instances: seeded as production to read its export,
// then seeded as the copy that follows it.

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

const f = require('../../helpers/mcp-fixtures');

const SUBJECT_LINES = 'redaction.subject-line'; // 2.1 active, 3.0 draft
const SPAM_WORDS = 'deliverability.spam-words'; // 1.0 active
const DARK_MODE = 'design.dark-mode'; // never published, 1.0 draft
const OLD_RULES = 'redaction.old-rules'; // archived
const SUBJECT_IDEAS = 'redaction.subject-ideas'; // a feature skill, served
const LOCAL_ONLY = 'other.local-experiment';

const ALICE = { id: f.ALICE, name: 'Alice', role: 'super_admin' };

const PRODUCTION = {
  ...f.SEED,
  expertises: f.EXPERTISES.map((e) =>
    e.expertiseId === SUBJECT_LINES ? { ...e, audience: 'all' } : e
  ),
  skills: f.SKILLS.map((s) =>
    s.skillId === SUBJECT_IDEAS ? { ...s, audience: 'all' } : s
  ),
};
const EMPTY_COPY = { ...f.SEED, expertises: [], skills: [] };

const version = (versionMajor, versionMinor, status, body) => ({
  versionMajor,
  versionMinor,
  status,
  body,
  examplesGood: [],
  examplesBad: [],
});
const subjectLinesWith = (versions, activeVersion) => ({
  ...f.EXPERTISES[0],
  activeVersion,
  versions,
});

const expertiseOf = (id) =>
  store.stored('expertises').find((e) => e.expertiseId === id);
const skillOf = (id) => store.stored('skills').find((s) => s.skillId === id);
const versionOf = (doc, major, minor) =>
  doc.versions.find(
    (v) => v.versionMajor === major && v.versionMinor === minor
  );

describe('a copy following production', () => {
  let exportForCopies;
  let followProduction;
  let lastFollow;

  beforeAll(() => {
    // Required here, not at the top of the file: the module does not exist
    // until #1424 and #1425 ship it, and a top-level require would break the
    // suite.
    ({
      exportForCopies,
      followProduction,
      lastFollow,
    } = require('../../../packages/server/ai-skill/services/skills-follow.service'));
  });

  // Production's answer, read once as production, then followed by the copy.
  let production;
  beforeEach(async () => {
    store.seed(PRODUCTION);
    production = JSON.parse(JSON.stringify(await exportForCopies()));
  });

  const follow = (seed, answer = production) => {
    store.seed(seed);
    return followProduction({
      fetchExport: async () => JSON.parse(JSON.stringify(answer)),
      actor: ALICE,
    });
  };

  // Turned on by #1424 (production's read tokens and read route)
  describe("production's answer", () => {
    it('holds every skill and expertise production has, archived ones included', () => {
      expect(production.expertises.map((e) => e.expertiseId).sort()).toEqual(
        [DARK_MODE, SPAM_WORDS, SUBJECT_LINES, OLD_RULES].sort()
      );
      expect(production.skills.map((s) => s.skillId)).toContain(SUBJECT_IDEAS);
    });

    it('carries the active version, the open draft, the state, the audience and the mark', () => {
      const subjectLines = production.expertises.find(
        (e) => e.expertiseId === SUBJECT_LINES
      );
      expect(subjectLines).toMatchObject({
        status: 'active',
        audience: 'all',
        version: { major: 2, minor: 1 },
        draft: { major: 3, minor: 0 },
      });
      expect(
        production.skills.find((s) => s.skillId === SUBJECT_IDEAS)
      ).toMatchObject({ servedToAssistants: true, audience: 'all' });
    });

    it('carries a draft never published as a draft only', () => {
      const darkMode = production.expertises.find(
        (e) => e.expertiseId === DARK_MODE
      );
      expect(darkMode.version).toBeUndefined();
      expect(darkMode.draft).toMatchObject({ major: 1, minor: 0 });
    });

    it('carries no history and no owner', () => {
      expect(JSON.stringify(production)).not.toContain('Under 60 characters.');
      production.expertises.forEach((e) => {
        expect(e).not.toHaveProperty('owner');
        expect(e).not.toHaveProperty('_id');
      });
    });
  });

  // Turned on by #1425 (a copy follows production on demand)
  describe('following', () => {
    it('brings what is active in production active on the copy', async () => {
      await follow(EMPTY_COPY);

      const subjectLines = expertiseOf(SUBJECT_LINES);
      expect(subjectLines.activeVersion).toEqual({ major: 2, minor: 1 });
      expect(versionOf(subjectLines, 2, 1).status).toBe('ACTIVE');
      expect(subjectLines.status).toBe('ACTIVE');
    });

    it('brings a draft of production as a draft', async () => {
      await follow(EMPTY_COPY);

      expect(versionOf(expertiseOf(SUBJECT_LINES), 3, 0).status).toBe('DRAFT');
      const darkMode = expertiseOf(DARK_MODE);
      expect(darkMode.activeVersion.major).toBeNull();
      expect(versionOf(darkMode, 1, 0).status).toBe('DRAFT');
    });

    it("takes production's audience and served-to-assistants mark", async () => {
      await follow(EMPTY_COPY);

      expect(expertiseOf(SUBJECT_LINES).audience).toBe('all');
      expect(skillOf(SUBJECT_IDEAS)).toMatchObject({
        audience: 'all',
        servedToAssistants: true,
      });
    });

    it('brings what production archived archived', async () => {
      await follow(EMPTY_COPY);

      expect(expertiseOf(OLD_RULES).status).toBe('ARCHIVED');
    });

    it('moves an item the copy has behind production forward, archiving its old active version', async () => {
      const report = await follow({
        ...EMPTY_COPY,
        expertises: [
          subjectLinesWith([version(1, 0, 'ACTIVE', '## Old')], {
            major: 1,
            minor: 0,
          }),
        ],
      });

      const subjectLines = expertiseOf(SUBJECT_LINES);
      expect(subjectLines.activeVersion).toEqual({ major: 2, minor: 1 });
      expect(versionOf(subjectLines, 1, 0).status).toBe('ARCHIVED');
      expect(report.updated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'expertise', id: SUBJECT_LINES }),
        ])
      );
    });

    it('keeps what exists only on the copy', async () => {
      const local = {
        expertiseId: LOCAL_ONLY,
        title: 'A local experiment',
        category: 'other',
        status: 'DRAFT',
        activeVersion: { major: null, minor: 0 },
        versions: [version(1, 0, 'DRAFT', '## Trying')],
      };

      const report = await follow({ ...EMPTY_COPY, expertises: [local] });

      expect(expertiseOf(LOCAL_ONLY)).toMatchObject({
        title: 'A local experiment',
      });
      expect(report.kept).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: LOCAL_ONLY, reason: 'local_only' }),
        ])
      );
    });

    it('never overwrites a local draft newer than production', async () => {
      store.seed({
        ...PRODUCTION,
        expertises: PRODUCTION.expertises.map((e) =>
          e.expertiseId === SUBJECT_LINES
            ? { ...e, versions: e.versions.filter((v) => v.status !== 'DRAFT') }
            : e
        ),
      });
      const withoutDraft = JSON.parse(JSON.stringify(await exportForCopies()));

      await follow(
        {
          ...EMPTY_COPY,
          expertises: [
            subjectLinesWith(
              [
                version(2, 1, 'ACTIVE', f.EXPERTISES[0].versions[1].body),
                version(2, 2, 'DRAFT', '## Mine\n\nWritten on the copy.'),
              ],
              { major: 2, minor: 1 }
            ),
          ],
        },
        withoutDraft
      );

      expect(versionOf(expertiseOf(SUBJECT_LINES), 2, 2)).toMatchObject({
        status: 'DRAFT',
        body: '## Mine\n\nWritten on the copy.',
      });
    });

    it('never moves the copy back to an older version', async () => {
      const report = await follow({
        ...EMPTY_COPY,
        expertises: [
          subjectLinesWith([version(4, 0, 'ACTIVE', '## Ahead')], {
            major: 4,
            minor: 0,
          }),
        ],
      });

      expect(expertiseOf(SUBJECT_LINES).activeVersion).toEqual({
        major: 4,
        minor: 0,
      });
      expect(report.kept).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: SUBJECT_LINES, reason: 'copy_newer' }),
        ])
      );
    });

    it('goes on when one item fails, and says which', async () => {
      store.seed(EMPTY_COPY);
      const create = store.models.Expertises.create;
      store.models.Expertises.create = async (record) => {
        if (record.expertiseId === SPAM_WORDS) {
          throw new Error('Expertise validation failed');
        }
        return create(record);
      };

      const report = await followProduction({
        fetchExport: async () => JSON.parse(JSON.stringify(production)),
        actor: ALICE,
      });
      store.models.Expertises.create = create;

      expect(report.failed).toEqual([
        expect.objectContaining({ kind: 'expertise', id: SPAM_WORDS }),
      ]);
      expect(expertiseOf(SPAM_WORDS)).toBeUndefined();
      expect(expertiseOf(SUBJECT_LINES)).toBeDefined();
    });

    it('writes nothing when production cannot be reached', async () => {
      store.seed(EMPTY_COPY);

      const report = await followProduction({
        fetchExport: async () => {
          throw new Error('connect ECONNREFUSED');
        },
        actor: ALICE,
      });

      expect(report).toMatchObject({ status: 'failed' });
      expect(store.stored('expertises')).toEqual([]);
      expect(store.stored('skills')).toEqual([]);
    });

    it('writes nothing when production answers something it cannot read', async () => {
      store.seed(EMPTY_COPY);

      const report = await followProduction({
        fetchExport: async () => ({ format: 2 }),
        actor: ALICE,
      });

      expect(report).toMatchObject({ status: 'failed' });
      expect(store.stored('expertises')).toEqual([]);
    });

    it('rewrites nothing a second time, and says so', async () => {
      await follow(EMPTY_COPY);
      const report = await followProduction({
        fetchExport: async () => JSON.parse(JSON.stringify(production)),
        actor: ALICE,
      });

      expect(report).toMatchObject({
        status: 'succeeded',
        created: [],
        updated: [],
        failed: [],
      });
      expect(report.upToDate.map((entry) => entry.id)).toEqual(
        expect.arrayContaining([SUBJECT_LINES, SUBJECT_IDEAS])
      );
    });

    it('records each follow, and tells the last one', async () => {
      await follow(EMPTY_COPY);

      expect(await lastFollow()).toMatchObject({
        status: 'succeeded',
        by: 'Alice',
        created: expect.any(Number),
        failed: 0,
      });
    });

    it('records a follow that failed too', async () => {
      store.seed(EMPTY_COPY);
      await followProduction({
        fetchExport: async () => {
          throw new Error('timeout');
        },
        actor: ALICE,
      });

      expect(await lastFollow()).toMatchObject({ status: 'failed' });
    });
  });
});

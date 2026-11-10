/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A copy follows production (ADR 0019, epic #1420). Production is the source
// of skills and expertises; a copy (staging, development) follows it in
// everything, and what the copy wrote itself is never lost: it leaves for a
// new item of the copy. One store stands for both instances: seeded as
// production to read its answer, then seeded as the copy that follows it.

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
const {
  exportForCopies,
} = require('../../../packages/server/ai-skill/services/skills-follow.format');
const {
  followProduction,
} = require('../../../packages/server/ai-skill/services/skills-follow.service');
const {
  lastFollow,
} = require('../../../packages/server/ai-skill/services/skills-follow-lock');

const SUBJECT_LINES = 'redaction.subject-line'; // 2.1 active, 3.0 draft
const SPAM_WORDS = 'deliverability.spam-words'; // 1.0 active
const DARK_MODE = 'design.dark-mode'; // never published, 1.0 draft
const OLD_RULES = 'redaction.old-rules'; // archived
const SUBJECT_IDEAS = 'redaction.subject-ideas'; // a feature skill, served
const REVIEW = 'qc.review'; // a task skill, consuming an expertise missing
const LOCAL_ONLY = 'other.local-experiment';
const COPY_OF_SUBJECT_LINES = `${SUBJECT_LINES}.copie`;

const ALICE = { id: f.ALICE, name: 'Alice', role: 'super_admin' };

const PRODUCTION = {
  ...f.SEED,
  expertises: f.EXPERTISES.map((e) =>
    e.expertiseId === SUBJECT_LINES ? { ...e, audience: 'all' } : e
  ),
  skills: [
    ...f.SKILLS.map((s) =>
      s.skillId === SUBJECT_IDEAS ? { ...s, audience: 'all' } : s
    ),
    {
      skillId: REVIEW,
      title: 'Review an email',
      category: 'qc',
      status: 'ACTIVE',
      audience: 'all',
      activeVersion: { major: 1, minor: 0 },
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          status: 'ACTIVE',
          nature: 'task',
          procedure: '1. Read the email.',
          consumedExpertiseIds: [SUBJECT_LINES, 'qc.not-here'],
        },
      ],
    },
  ],
};
const EMPTY_COPY = { ...f.SEED, expertises: [], skills: [] };

const version = (versionMajor, versionMinor, status, body, extra = {}) => ({
  versionMajor,
  versionMinor,
  status,
  body,
  examplesGood: [],
  examplesBad: [],
  ...extra,
});
const V2_1 = f.EXPERTISES[0].versions[1];
const subjectLinesWith = (versions, activeVersion, extra = {}) => ({
  ...f.EXPERTISES[0],
  activeVersion,
  versions,
  ...extra,
});

const expertiseOf = (id) =>
  store.stored('expertises').find((e) => e.expertiseId === id);
const skillOf = (id) => store.stored('skills').find((s) => s.skillId === id);
const versionOf = (doc, major, minor) =>
  doc.versions.find(
    (v) => v.versionMajor === major && v.versionMinor === minor
  );
const idsOf = (list) => list.map(({ id }) => id);
const clone = (value) => JSON.parse(JSON.stringify(value));
// A date, whatever realm the fake models' copies built it in.
const isDate = (value) =>
  Object.prototype.toString.call(value) === '[object Date]';

describe('a copy following production', () => {
  // Production's answer, read once as production, then followed by the copy.
  let production;
  beforeEach(async () => {
    store.seed(PRODUCTION);
    production = clone(await exportForCopies());
  });

  const followAgain = (answer = production) =>
    followProduction({ fetchExport: async () => clone(answer), actor: ALICE });
  const follow = (seed, answer = production) => {
    store.seed(seed);
    return followAgain(answer);
  };
  // Production's answer, one item changed.
  const answerWith = (id, change) => {
    const answer = clone(production);
    const item = answer.expertises.find((e) => e.expertiseId === id);
    change(item, answer);
    return answer;
  };
  // A change made on the copy, to its stored item.
  const changeOnCopy = (id, change) => {
    const doc = expertiseOf(id);
    store.update('expertises', doc._id, change(doc));
  };

  describe('in everything', () => {
    it('brings what is active in production active on the copy, marked as followed', async () => {
      await follow(EMPTY_COPY);

      const subjectLines = expertiseOf(SUBJECT_LINES);
      expect(subjectLines.activeVersion).toEqual({ major: 2, minor: 1 });
      expect(subjectLines.status).toBe('ACTIVE');
      expect(isDate(subjectLines.followedAt)).toBe(true);
      const active = versionOf(subjectLines, 2, 1);
      expect(active.status).toBe('ACTIVE');
      expect(isDate(active.followedAt)).toBe(true);
      expect(active.updatedAt).toEqual(active.followedAt);
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

    it('moves an item behind production forward, archiving the version production archived', async () => {
      await follow(EMPTY_COPY);
      const answer = answerWith(SUBJECT_LINES, (item) => {
        item.version = { ...item.draft, changelog: 'Now active' };
        delete item.draft;
      });

      const report = await followAgain(answer);

      const subjectLines = expertiseOf(SUBJECT_LINES);
      expect(subjectLines.activeVersion).toEqual({ major: 3, minor: 0 });
      expect(versionOf(subjectLines, 2, 1).status).toBe('ARCHIVED');
      expect(versionOf(subjectLines, 3, 0)).toMatchObject({
        status: 'ACTIVE',
        changelog: 'Now active',
      });
      expect(idsOf(report.updated)).toContain(SUBJECT_LINES);
      expect(report.moved).toEqual([]);
    });

    // The copy closed to clients what production closes, even when the
    // copy had published past production.
    it('follows an audience production closes, the copy ahead or not', async () => {
      const closed = answerWith(SUBJECT_LINES, (item) => {
        item.audience = 'platform';
      });

      await follow(
        {
          ...EMPTY_COPY,
          expertises: [
            subjectLinesWith(
              [version(4, 0, 'ACTIVE', '## Ahead\n\nPublished on the copy.')],
              { major: 4, minor: 0 },
              { audience: 'all' }
            ),
          ],
        },
        closed
      );

      expect(expertiseOf(SUBJECT_LINES)).toMatchObject({
        audience: 'platform',
        activeVersion: { major: 2, minor: 1 },
      });
    });

    it('takes over an item the copy holds as production does, without moving anything', async () => {
      const report = await follow({
        ...EMPTY_COPY,
        expertises: [
          subjectLinesWith([version(2, 1, 'ACTIVE', V2_1.body, V2_1)], {
            major: 2,
            minor: 1,
          }),
        ],
      });

      expect(report.moved).toEqual([]);
      expect(expertiseOf(COPY_OF_SUBJECT_LINES)).toBeUndefined();
      expect(
        isDate(versionOf(expertiseOf(SUBJECT_LINES), 2, 1).followedAt)
      ).toBe(true);
    });
  });

  describe("the copy's own work", () => {
    it('moves a draft of the copy out when production brings one at its number', async () => {
      const report = await follow({
        ...EMPTY_COPY,
        expertises: [
          subjectLinesWith(
            [
              version(2, 1, 'ACTIVE', V2_1.body, V2_1),
              version(3, 0, 'DRAFT', '## Mine\n\nWritten on the copy.'),
            ],
            { major: 2, minor: 1 }
          ),
        ],
      });

      expect(versionOf(expertiseOf(SUBJECT_LINES), 3, 0).body).toBe(
        f.EXPERTISES[0].versions[2].body
      );
      expect(expertiseOf(COPY_OF_SUBJECT_LINES)).toMatchObject({
        title: 'Subject lines (travail de la copie)',
        copiedFrom: SUBJECT_LINES,
        audience: 'platform',
        status: 'DRAFT',
        activeVersion: { major: null, minor: 0 },
        versions: [
          expect.objectContaining({
            versionMajor: 3,
            versionMinor: 0,
            status: 'DRAFT',
            body: '## Mine\n\nWritten on the copy.',
          }),
        ],
      });
      expect(
        versionOf(expertiseOf(COPY_OF_SUBJECT_LINES), 3, 0).followedAt
      ).toBeUndefined();
      expect(report.moved).toEqual([
        expect.objectContaining({
          kind: 'expertise',
          id: SUBJECT_LINES,
          copyId: COPY_OF_SUBJECT_LINES,
        }),
      ]);
    });

    it('moves a version published on the copy out, and follows production', async () => {
      const report = await follow({
        ...EMPTY_COPY,
        expertises: [
          subjectLinesWith(
            [version(4, 0, 'ACTIVE', '## Ahead\n\nPublished on the copy.')],
            { major: 4, minor: 0 }
          ),
        ],
      });

      const subjectLines = expertiseOf(SUBJECT_LINES);
      expect(subjectLines.activeVersion).toEqual({ major: 2, minor: 1 });
      expect(versionOf(subjectLines, 4, 0)).toBeUndefined();
      expect(versionOf(expertiseOf(COPY_OF_SUBJECT_LINES), 4, 0)).toMatchObject(
        {
          status: 'DRAFT',
          body: '## Ahead\n\nPublished on the copy.',
        }
      );
      expect(report.kept).not.toContainEqual(
        expect.objectContaining({ id: SUBJECT_LINES })
      );
    });

    // Received from production, then changed on the copy: the copy's work.
    it('moves a received draft the copy changed since', async () => {
      await follow(EMPTY_COPY);
      changeOnCopy(SUBJECT_LINES, (doc) => ({
        versions: doc.versions.map((v) =>
          v.versionMajor === 3
            ? {
                ...v,
                body: '## Length\n\nChanged on the copy.',
                updatedAt: new Date(v.followedAt.getTime() + 1000),
              }
            : v
        ),
      }));

      const report = await followAgain();

      expect(versionOf(expertiseOf(SUBJECT_LINES), 3, 0).body).toBe(
        f.EXPERTISES[0].versions[2].body
      );
      expect(versionOf(expertiseOf(COPY_OF_SUBJECT_LINES), 3, 0).body).toBe(
        '## Length\n\nChanged on the copy.'
      );
      expect(report.moved).toHaveLength(1);
    });

    // An item imported before the copy followed production: the first
    // follow takes it over, unless a person kept it on the copy.
    describe('an item imported before the copy followed production', () => {
      const imported = (extra = {}) => ({
        ...EMPTY_COPY,
        expertises: [
          subjectLinesWith(
            [
              version(1, 0, 'ACTIVE', '## Imported\n\nPublished by hand.', {
                activatedAt: new Date(),
              }),
            ],
            { major: 1, minor: 0 },
            extra
          ),
        ],
      });

      it('has its version that differs from production moved out', async () => {
        const report = await follow(imported());

        expect(expertiseOf(SUBJECT_LINES).activeVersion).toEqual({
          major: 2,
          minor: 1,
        });
        expect(versionOf(expertiseOf(SUBJECT_LINES), 1, 0)).toBeUndefined();
        expect(
          versionOf(expertiseOf(COPY_OF_SUBJECT_LINES), 1, 0)
        ).toMatchObject({
          status: 'DRAFT',
          body: '## Imported\n\nPublished by hand.',
        });
        expect(report.moved).toHaveLength(1);
      });

      it('is left as it is when kept on the copy', async () => {
        const report = await follow(imported({ keptOnCopy: true }));

        expect(expertiseOf(SUBJECT_LINES).activeVersion).toEqual({
          major: 1,
          minor: 0,
        });
        expect(expertiseOf(COPY_OF_SUBJECT_LINES)).toBeUndefined();
        expect(report.kept).toContainEqual(
          expect.objectContaining({
            id: SUBJECT_LINES,
            reason: 'kept_on_copy',
            productionChanged: true,
          })
        );
      });
    });

    // Published on the copy, unchanged, while production keeps it a draft:
    // the copy's publication is its work, not a version to take back.
    it('moves a received draft the copy published, as a draft', async () => {
      await follow(EMPTY_COPY);
      changeOnCopy(SUBJECT_LINES, (doc) => {
        const at = new Date(versionOf(doc, 3, 0).followedAt.getTime() + 1000);
        return {
          activeVersion: { major: 3, minor: 0 },
          versions: doc.versions.map((v) => {
            if (v.versionMajor === 3) {
              return { ...v, status: 'ACTIVE', activatedAt: at };
            }
            return v.status === 'ACTIVE' ? { ...v, status: 'ARCHIVED' } : v;
          }),
        };
      });

      const report = await followAgain();

      const subjectLines = expertiseOf(SUBJECT_LINES);
      expect(subjectLines.activeVersion).toEqual({ major: 2, minor: 1 });
      expect(versionOf(subjectLines, 2, 1).status).toBe('ACTIVE');
      expect(versionOf(subjectLines, 3, 0).status).toBe('DRAFT');
      expect(versionOf(expertiseOf(COPY_OF_SUBJECT_LINES), 3, 0)).toMatchObject(
        {
          status: 'DRAFT',
          body: f.EXPERTISES[0].versions[2].body,
        }
      );
      expect(report.moved).toEqual([
        expect.objectContaining({ id: SUBJECT_LINES }),
      ]);
    });

    it('keeps a draft of the copy ahead of production when production brings none', async () => {
      const withoutDraft = answerWith(SUBJECT_LINES, (item) => {
        delete item.draft;
      });

      const report = await follow(
        {
          ...EMPTY_COPY,
          expertises: [
            subjectLinesWith(
              [
                version(2, 1, 'ACTIVE', V2_1.body, V2_1),
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
      expect(report.moved).toEqual([]);
      expect(expertiseOf(COPY_OF_SUBJECT_LINES)).toBeUndefined();
    });

    it('never touches an item written on the copy', async () => {
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
        versions: [expect.objectContaining({ body: '## Trying' })],
      });
      expect(report.kept).toContainEqual(
        expect.objectContaining({ id: LOCAL_ONLY, reason: 'local_only' })
      );
    });

    it('takes the next free id for a second move', async () => {
      await follow(EMPTY_COPY);
      await store.models.Expertises.create({
        ...expertiseOf(SUBJECT_LINES),
        _id: undefined,
        expertiseId: COPY_OF_SUBJECT_LINES,
      });
      changeOnCopy(SUBJECT_LINES, (doc) => ({
        versions: doc.versions.map((v) =>
          v.versionMajor === 3
            ? {
                ...v,
                body: '## Again\n\nWritten on the copy.',
                followedAt: undefined,
              }
            : v
        ),
      }));

      const report = await followAgain();

      expect(report.moved[0].copyId).toBe(`${SUBJECT_LINES}.copie-2`);
    });
  });

  describe('what production removes', () => {
    it('removes a draft the copy received, when production no longer has it', async () => {
      await follow(EMPTY_COPY);
      const withoutDraft = answerWith(SUBJECT_LINES, (item) => {
        delete item.draft;
      });

      const report = await followAgain(withoutDraft);

      expect(versionOf(expertiseOf(SUBJECT_LINES), 3, 0)).toBeUndefined();
      expect(report.removed).toEqual([
        expect.objectContaining({ id: SUBJECT_LINES, version: '3.0' }),
      ]);
    });

    it('removes an item never published the copy received, when production no longer has it', async () => {
      await follow(EMPTY_COPY);
      const answer = clone(production);
      answer.expertises = answer.expertises.filter(
        (e) => e.expertiseId !== DARK_MODE
      );

      const report = await followAgain(answer);

      expect(expertiseOf(DARK_MODE)).toBeUndefined();
      expect(report.removed).toEqual([
        expect.objectContaining({ id: DARK_MODE, version: null }),
      ]);
    });
  });

  describe('an item kept on the copy', () => {
    const keep = () =>
      changeOnCopy(SUBJECT_LINES, () => ({ keptOnCopy: true }));

    it('is left as it is, saying production changed', async () => {
      await follow(EMPTY_COPY);
      keep();
      const before = expertiseOf(SUBJECT_LINES);
      const closed = answerWith(SUBJECT_LINES, (item) => {
        item.audience = 'platform';
      });

      const report = await followAgain(closed);

      expect(expertiseOf(SUBJECT_LINES)).toEqual(before);
      expect(report.kept).toContainEqual(
        expect.objectContaining({
          id: SUBJECT_LINES,
          reason: 'kept_on_copy',
          productionChanged: true,
        })
      );
    });

    it('says production did not change when it did not', async () => {
      await follow(EMPTY_COPY);
      keep();

      const report = await followAgain();

      expect(report.kept).toContainEqual(
        expect.objectContaining({
          id: SUBJECT_LINES,
          productionChanged: false,
        })
      );
    });

    it('follows production again once attached, its work moved out', async () => {
      await follow(EMPTY_COPY);
      keep();
      // Published on the copy while it was kept there.
      changeOnCopy(SUBJECT_LINES, (doc) => ({
        activeVersion: { major: 2, minor: 2 },
        versions: [
          ...doc.versions.map((v) =>
            v.versionMinor === 1 ? { ...v, status: 'ARCHIVED' } : v
          ),
          version(2, 2, 'ACTIVE', '## Mine\n\nPublished on the copy.'),
        ],
      }));
      changeOnCopy(SUBJECT_LINES, () => ({ keptOnCopy: false }));

      const report = await followAgain();

      const subjectLines = expertiseOf(SUBJECT_LINES);
      expect(subjectLines.activeVersion).toEqual({ major: 2, minor: 1 });
      expect(versionOf(subjectLines, 2, 1).status).toBe('ACTIVE');
      expect(versionOf(subjectLines, 2, 2)).toBeUndefined();
      expect(versionOf(expertiseOf(COPY_OF_SUBJECT_LINES), 2, 2).body).toBe(
        '## Mine\n\nPublished on the copy.'
      );
      expect(report.moved).toEqual([
        expect.objectContaining({ id: SUBJECT_LINES }),
      ]);
    });
  });

  describe('its writes', () => {
    it('writes nothing a second time, and says so', async () => {
      await follow(EMPTY_COPY);
      const before = {
        expertises: store.stored('expertises'),
        skills: store.stored('skills'),
      };

      const report = await followAgain();

      expect(report).toMatchObject({
        status: 'succeeded',
        created: [],
        updated: [],
        moved: [],
        removed: [],
        failed: [],
      });
      expect(idsOf(report.upToDate)).toEqual(
        expect.arrayContaining([SUBJECT_LINES, SUBJECT_IDEAS])
      );
      expect(store.stored('expertises')).toEqual(before.expertises);
      expect(store.stored('skills')).toEqual(before.skills);
    });

    it('fails an item written meanwhile, without writing over it', async () => {
      await follow(EMPTY_COPY);
      const closed = answerWith(SUBJECT_LINES, (item) => {
        item.audience = 'platform';
      });
      const { findOneAndUpdate } = store.models.Expertises;
      store.models.Expertises.findOneAndUpdate = (...args) => {
        // A person saves the item between the follow's read and its write.
        changeOnCopy(SUBJECT_LINES, () => ({
          title: 'Saved meanwhile',
          updatedAt: new Date(),
        }));
        return findOneAndUpdate(...args);
      };

      let report;
      try {
        report = await followAgain(closed);
      } finally {
        store.models.Expertises.findOneAndUpdate = findOneAndUpdate;
      }

      expect(report.status).toBe('partial');
      expect(report.failed).toEqual([
        expect.objectContaining({
          id: SUBJECT_LINES,
          code: 'SKILLS_FOLLOW_ITEM_CHANGED',
        }),
      ]);
      expect(expertiseOf(SUBJECT_LINES)).toMatchObject({
        title: 'Saved meanwhile',
        audience: 'all',
      });
    });

    // What production no longer says of an item, the copy no longer says.
    it('unsets on the copy what production emptied', async () => {
      await follow(EMPTY_COPY);
      const emptied = answerWith(SUBJECT_LINES, (item) => {
        delete item.description;
      });
      // MongoDB's `$unset`, which the fake models leave to the test.
      const { findOneAndUpdate } = store.models.Expertises;
      const unsets = [];
      store.models.Expertises.findOneAndUpdate = (filter, update, options) => {
        const { $unset, ...rest } = update;
        if ($unset) {
          unsets.push($unset);
          const doc = store
            .stored('expertises')
            .find((e) => e.expertiseId === filter.expertiseId);
          Object.keys($unset).forEach((field) =>
            changeOnCopy(doc.expertiseId, () => ({ [field]: undefined }))
          );
        }
        return findOneAndUpdate(filter, rest, options);
      };

      let report;
      try {
        report = await followAgain(emptied);
      } finally {
        store.models.Expertises.findOneAndUpdate = findOneAndUpdate;
      }

      expect(unsets).toEqual([{ description: '' }]);
      expect(expertiseOf(SUBJECT_LINES).description).toBeUndefined();
      expect(idsOf(report.updated)).toEqual([SUBJECT_LINES]);
      // Then up to date: nothing more to unset.
      const again = await followAgain(emptied);
      expect(again.updated).toEqual([]);
    });

    // A write conditioned on a version's update date never mistakes one
    // written since for the one read (ADR 0014).
    it('gives a later update date than the one a version had', async () => {
      const later = new Date(Date.now() + 60 * 60 * 1000);
      await follow({
        ...EMPTY_COPY,
        expertises: [
          subjectLinesWith(
            [version(2, 1, 'ACTIVE', V2_1.body, { ...V2_1, updatedAt: later })],
            { major: 2, minor: 1 }
          ),
        ],
      });

      const followed = versionOf(expertiseOf(SUBJECT_LINES), 2, 1);
      expect(followed.updatedAt.getTime()).toBeGreaterThan(later.getTime());
    });

    it('warns of a skill whose consumed expertise the copy lacks', async () => {
      const report = await follow(EMPTY_COPY);

      expect(report.created).toContainEqual(
        expect.objectContaining({
          id: REVIEW,
          warnings: [
            { code: 'missing_expertises', expertiseIds: ['qc.not-here'] },
          ],
        })
      );
    });

    it('goes on when one item fails, and says which by a code', async () => {
      store.seed(EMPTY_COPY);
      const { create } = store.models.Expertises;
      store.models.Expertises.create = async (record) => {
        if (record.expertiseId === SPAM_WORDS) {
          throw Object.assign(new Error('Expertise validation failed'), {
            name: 'ValidationError',
          });
        }
        return create(record);
      };

      let report;
      try {
        report = await followAgain();
      } finally {
        store.models.Expertises.create = create;
      }

      expect(report.failed).toEqual([
        {
          kind: 'expertise',
          id: SPAM_WORDS,
          version: '1.0',
          code: 'SKILLS_FOLLOW_ITEM_INVALID',
        },
      ]);
      expect(expertiseOf(SPAM_WORDS)).toBeUndefined();
      expect(expertiseOf(SUBJECT_LINES)).toBeDefined();
    });
  });

  describe("production's answer", () => {
    it('writes nothing when production cannot be reached', async () => {
      store.seed(EMPTY_COPY);

      const failed = await followProduction({
        fetchExport: async () => {
          throw new Error('connect ECONNREFUSED');
        },
        actor: ALICE,
      });

      expect(failed).toMatchObject({
        status: 'failed',
        reason: 'unreachable',
        code: 'SKILLS_FOLLOW_UNREACHABLE',
      });
      expect(store.stored('expertises')).toEqual([]);
    });

    it('writes nothing when production answers a format this copy does not read', async () => {
      const report = await follow(EMPTY_COPY, {
        ...production,
        followFormat: 3,
      });

      expect(report).toMatchObject({
        status: 'failed',
        reason: 'unreadable',
        code: 'SKILLS_FOLLOW_UNREADABLE',
      });
      expect(store.stored('expertises')).toEqual([]);
    });

    // A copy deployed ahead of production, as during a walkthrough.
    it("reads production's first answers, before the format had its number", async () => {
      const { followFormat: _ours, ...first } = production;

      const report = await follow(EMPTY_COPY, { ...first, format: 1 });

      expect(report.status).toBe('succeeded');
      expect(expertiseOf(SUBJECT_LINES)).toBeDefined();
    });

    it('refuses an item it cannot read alone, and keeps the copy of it', async () => {
      await follow(EMPTY_COPY);
      const answer = answerWith(DARK_MODE, (item) => {
        item.title = 5;
      });

      const report = await followAgain(answer);

      expect(report.status).toBe('partial');
      expect(report.failed).toEqual([
        expect.objectContaining({
          kind: 'expertise',
          id: DARK_MODE,
          code: 'SKILLS_FOLLOW_ITEM_UNREADABLE',
          field: expect.stringMatching(/^expertises\.\d+\.title$/),
        }),
      ]);
      expect(expertiseOf(DARK_MODE)).toBeDefined();
      expect(report.removed).toEqual([]);
    });
  });

  describe('its record', () => {
    it('records each follow, and tells the last one', async () => {
      await follow(EMPTY_COPY);

      const last = await lastFollow();
      expect(last).toMatchObject({
        status: 'succeeded',
        by: 'Alice',
        trigger: 'manual',
        failed: [],
        failures: [],
      });
      expect(idsOf(last.created)).toContain(SUBJECT_LINES);
    });

    it('records a follow that failed too', async () => {
      store.seed(EMPTY_COPY);
      await followProduction({
        fetchExport: async () => {
          throw Object.assign(new Error('Production refused the read token.'), {
            reason: 'token_refused',
            code: 'SKILLS_FOLLOW_TOKEN_REFUSED',
          });
        },
        actor: ALICE,
      });

      expect(await lastFollow()).toMatchObject({
        status: 'failed',
        reason: 'token_refused',
        code: 'SKILLS_FOLLOW_TOKEN_REFUSED',
      });
    });

    // The page shows the detail of the last follow after a reload too.
    it('tells each item as the follow answered it', async () => {
      await follow({
        ...EMPTY_COPY,
        expertises: [
          subjectLinesWith(
            [version(4, 0, 'ACTIVE', '## Ahead\n\nPublished on the copy.')],
            { major: 4, minor: 0 }
          ),
        ],
      });

      const last = await lastFollow();
      expect(last.moved).toEqual([
        expect.objectContaining({
          id: SUBJECT_LINES,
          copyId: COPY_OF_SUBJECT_LINES,
        }),
      ]);
      expect(last.created).toContainEqual(
        expect.objectContaining({
          id: REVIEW,
          warnings: [
            { code: 'missing_expertises', expertiseIds: ['qc.not-here'] },
          ],
        })
      );
      expect(last.kept).toEqual([]);
    });
  });

  describe('one follow at a time', () => {
    const running = (expiresAt) => ({
      _id: '507f1f77bcf86cd799439f01',
      status: 'running',
      trigger: 'night',
      by: '',
      startedAt: new Date(),
      expiresAt,
    });

    it('refuses a follow while another one runs, writing nothing', async () => {
      store.seed({
        ...EMPTY_COPY,
        follows: [running(new Date(Date.now() + 60 * 1000))],
      });

      await expect(followAgain()).rejects.toMatchObject({
        status: 409,
        message: 'SKILLS_FOLLOW_RUNNING',
      });
      expect(store.stored('expertises')).toEqual([]);
    });

    it('ends a follow that outlived its time, then follows', async () => {
      store.seed({
        ...EMPTY_COPY,
        follows: [running(new Date(Date.now() - 1000))],
      });

      const report = await followAgain();

      expect(report.status).toBe('succeeded');
      expect(store.stored('follows')[0]).toMatchObject({
        status: 'failed',
        reason: 'interrupted',
        code: 'SKILLS_FOLLOW_INTERRUPTED',
      });
    });

    it('releases the lock when the follow ends', async () => {
      await follow(EMPTY_COPY);

      expect(
        store.stored('follows').filter(({ status }) => status === 'running')
      ).toEqual([]);
      await expect(followAgain()).resolves.toMatchObject({
        status: 'succeeded',
      });
    });
  });
});

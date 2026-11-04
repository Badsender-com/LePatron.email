/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The skills export (ADR 0018, epic #1406): a super admin exports the active
// version of chosen skills and expertises as a file, and imports it on another
// instance, where each one arrives as a draft a person publishes. One instance
// stands for both here: the store is seeded as the source, the file is read,
// then the store is seeded again as the target.

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

const SUBJECT_LINES = 'redaction.subject-line';
const SPAM_WORDS = 'deliverability.spam-words';
const DARK_MODE = 'design.dark-mode'; // never published
const OLD_RULES = 'redaction.old-rules'; // archived
const SUBJECT_IDEAS = 'redaction.subject-ideas'; // a feature skill, served
const WRITE_SUBJECT = 'redaction.write-subject'; // a task skill

const ALICE = { id: f.ALICE, name: 'Alice', role: 'super_admin' };
const ORIGIN = 'https://source.lepatron.example';

const TASK_SKILL = {
  _id: '507f1f77bcf86cd799439903',
  skillId: WRITE_SUBJECT,
  title: 'Write a subject line',
  description: 'Writes the subject line of an email',
  category: 'redaction',
  status: 'ACTIVE',
  audience: 'all',
  activeVersion: { major: 1, minor: 0 },
  versions: [
    {
      versionMajor: 1,
      versionMinor: 0,
      status: 'ACTIVE',
      nature: 'task',
      procedure: '## Steps\n\n1. Read the brief.\n2. Write three subjects.',
      consumedExpertiseIds: [SUBJECT_LINES, SPAM_WORDS],
    },
  ],
};

const SOURCE = {
  ...f.SEED,
  expertises: f.EXPERTISES.map((e) =>
    e.expertiseId === SUBJECT_LINES ? { ...e, audience: 'all' } : e
  ),
  skills: [...f.SKILLS, TASK_SKILL],
};

// The target: the same users, none of the source's skills and expertises.
const EMPTY_TARGET = { ...f.SEED, expertises: [], skills: [] };

const expertiseOf = (id) =>
  store.stored('expertises').find((e) => e.expertiseId === id);
const skillOf = (id) => store.stored('skills').find((s) => s.skillId === id);
const draftOf = (doc) => doc.versions.find((v) => v.status === 'DRAFT');
const itemOf = (preview, id) => preview.items.find((item) => item.id === id);

describe('the skills export', () => {
  let exportSkills;
  let previewImport;
  let importSkills;
  let readSkillsExport;

  beforeAll(() => {
    // Required here, not at the top of the file: the module does not exist
    // until #1409 ships it, and a top-level require would break the suite.
    ({
      exportSkills,
      previewImport,
      importSkills,
      readSkillsExport,
    } = require('../../../packages/server/ai-skill/services/skills-export.service'));
  });

  beforeEach(() => store.seed(SOURCE));

  const exportOf = (selection) =>
    exportSkills(selection, { user: ALICE, origin: ORIGIN });

  describe('exporting', () => {
    it('says what it is, where it comes from, when and by whom', async () => {
      const file = await exportOf({ expertiseIds: [SUBJECT_LINES] });

      expect(file).toMatchObject({
        format: 1,
        origin: ORIGIN,
        exportedBy: 'Alice',
      });
      expect(new Date(file.exportedAt).getTime()).not.toBeNaN();
    });

    it('carries the active version only, never a draft nor the history', async () => {
      const file = await exportOf({ expertiseIds: [SUBJECT_LINES] });

      expect(file.expertises).toHaveLength(1);
      expect(file.expertises[0]).toMatchObject({
        expertiseId: SUBJECT_LINES,
        title: 'Subject lines',
        category: 'redaction',
        scope: ['subject'],
        appliesToLanguages: ['fr', 'en'],
        version: {
          major: 2,
          minor: 1,
          body:
            '## Length\n\nKeep the subject under 50 characters.\n\n## Tone\n\nOne promise, no shouting.',
          examplesGood: ['Black Friday: -30% on everything'],
          examplesBad: ['!!! HUGE SALE !!!'],
        },
      });
      expect(JSON.stringify(file)).not.toContain('A draft nobody validated.');
      expect(JSON.stringify(file)).not.toContain('Under 60 characters.');
    });

    it('carries nothing that belongs to the instance: audience, serving, owner', async () => {
      const file = await exportOf({
        expertiseIds: [SUBJECT_LINES],
        skillIds: [SUBJECT_IDEAS],
      });

      [...file.expertises, ...file.skills].forEach((item) => {
        expect(item).not.toHaveProperty('audience');
        expect(item).not.toHaveProperty('servedToAssistants');
        expect(item).not.toHaveProperty('owner');
        expect(item).not.toHaveProperty('_id');
      });
    });

    it('carries a feature skill with its template, schemas and test cases', async () => {
      const file = await exportOf({ skillIds: [SUBJECT_IDEAS] });

      expect(file.skills[0]).toMatchObject({
        skillId: SUBJECT_IDEAS,
        version: {
          major: 1,
          minor: 2,
          systemPrompt: 'You write email subject lines for a brand.',
          inputTemplate: 'Brief: {{input.prompt}}\nContext: {{input.context}}',
          inputSchemaId: 'genericTextInput',
          outputSchemaId: 'genericTextOutput',
        },
      });
    });

    it('adds the expertises a task skill consumes', async () => {
      const file = await exportOf({ skillIds: [WRITE_SUBJECT] });

      expect(file.expertises.map((e) => e.expertiseId).sort()).toEqual([
        SPAM_WORDS,
        SUBJECT_LINES,
      ]);
    });

    it('leaves out a consumed expertise the super admin removed', async () => {
      const file = await exportOf({
        skillIds: [WRITE_SUBJECT],
        withoutExpertiseIds: [SPAM_WORDS],
      });

      expect(file.expertises.map((e) => e.expertiseId)).toEqual([
        SUBJECT_LINES,
      ]);
    });

    it('exports every active skill and expertise, and nothing archived or never published', async () => {
      const file = await exportOf({ all: true });

      expect(file.expertises.map((e) => e.expertiseId).sort()).toEqual([
        SPAM_WORDS,
        SUBJECT_LINES,
      ]);
      expect(file.skills.map((s) => s.skillId).sort()).toEqual([
        SUBJECT_IDEAS,
        WRITE_SUBJECT,
      ]);
    });

    it('refuses to export an archived item or one with no active version', async () => {
      await expect(exportOf({ expertiseIds: [OLD_RULES] })).rejects.toThrow(
        /archived/
      );
      await expect(exportOf({ expertiseIds: [DARK_MODE] })).rejects.toThrow(
        /no active version/
      );
    });

    it('reads back the file it writes', async () => {
      const file = await exportOf({ all: true });

      expect(readSkillsExport(JSON.parse(JSON.stringify(file)))).toEqual(
        JSON.parse(JSON.stringify(file))
      );
    });

    it('refuses a file of an unknown format, or that fails validation', () => {
      expect(() => readSkillsExport({ format: 2 })).toThrow(/format/);
      expect(() =>
        readSkillsExport({ format: 1, expertises: [{ title: 'No id' }] })
      ).toThrow();
    });
  });

  describe('previewing an import', () => {
    let file;
    beforeEach(async () => {
      file = await exportOf({ all: true });
    });

    it('says new for what this instance does not have', async () => {
      store.seed(EMPTY_TARGET);

      const preview = await previewImport(file);

      expect(itemOf(preview, SUBJECT_LINES)).toMatchObject({
        kind: 'expertise',
        version: '2.1',
        state: 'new',
      });
      expect(itemOf(preview, SUBJECT_IDEAS).state).toBe('new');
    });

    it('says update when the file is ahead of the active version here', async () => {
      store.seed({
        ...EMPTY_TARGET,
        expertises: [
          {
            ...f.EXPERTISES[0],
            activeVersion: { major: 1, minor: 0 },
            versions: [{ ...f.EXPERTISES[0].versions[0], status: 'ACTIVE' }],
          },
        ],
      });

      expect(itemOf(await previewImport(file), SUBJECT_LINES).state).toBe(
        'update'
      );
    });

    it('says up to date for the same version with the same content', async () => {
      const preview = await previewImport(file);

      expect(itemOf(preview, SPAM_WORDS).state).toBe('up_to_date');
    });

    it('blocks the same version with a different content: the instances diverged', async () => {
      store.seed({
        ...SOURCE,
        expertises: SOURCE.expertises.map((e) =>
          e.expertiseId === SPAM_WORDS
            ? {
                ...e,
                versions: [
                  { ...e.versions[0], body: '## Words\n\nChanged here.' },
                ],
              }
            : e
        ),
      });

      expect(itemOf(await previewImport(file), SPAM_WORDS)).toMatchObject({
        state: 'blocked',
        reason: 'diverged',
      });
    });

    it('blocks what is newer here', async () => {
      store.seed({
        ...SOURCE,
        expertises: SOURCE.expertises.map((e) =>
          e.expertiseId === SPAM_WORDS
            ? {
                ...e,
                activeVersion: { major: 2, minor: 0 },
                versions: [{ ...e.versions[0], versionMajor: 2 }],
              }
            : e
        ),
      });

      expect(itemOf(await previewImport(file), SPAM_WORDS)).toMatchObject({
        state: 'blocked',
        reason: 'target_newer',
      });
    });

    // The source fixtures leave a 3.0 draft open on the subject lines.
    it('blocks what has a draft open here, which an import never overwrites', async () => {
      const older = await exportOf({ expertiseIds: [SUBJECT_LINES] });
      older.expertises[0].version.minor = 2;

      expect(itemOf(await previewImport(older), SUBJECT_LINES)).toMatchObject({
        state: 'blocked',
        reason: 'draft_open',
      });
    });

    it('blocks what is archived here', async () => {
      store.seed({
        ...EMPTY_TARGET,
        expertises: [{ ...f.EXPERTISES[1], status: 'ARCHIVED' }],
      });

      expect(itemOf(await previewImport(file), SPAM_WORDS)).toMatchObject({
        state: 'blocked',
        reason: 'archived',
      });
    });

    it('blocks a feature skill whose schema this instance does not have', async () => {
      store.seed(EMPTY_TARGET);
      file.skills.find(
        (s) => s.skillId === SUBJECT_IDEAS
      ).version.inputSchemaId = 'aSchemaFromANewerRelease';

      expect(itemOf(await previewImport(file), SUBJECT_IDEAS)).toMatchObject({
        state: 'blocked',
        reason: 'missing_schema',
      });
    });

    it('warns about a task skill whose expertise is neither in the file nor here', async () => {
      const alone = await exportOf({
        skillIds: [WRITE_SUBJECT],
        withoutExpertiseIds: [SPAM_WORDS],
      });
      store.seed(EMPTY_TARGET);

      expect(itemOf(await previewImport(alone), WRITE_SUBJECT)).toMatchObject({
        state: 'new',
        warnings: [{ code: 'missing_expertises', expertiseIds: [SPAM_WORDS] }],
      });
    });

    it('writes nothing', async () => {
      store.seed(EMPTY_TARGET);

      await previewImport(file);

      expect(store.stored('expertises')).toEqual([]);
      expect(store.stored('skills')).toEqual([]);
    });
  });

  describe('importing', () => {
    let file;
    beforeEach(async () => {
      file = await exportOf({ all: true });
      store.seed(EMPTY_TARGET);
    });

    const importAll = () =>
      importSkills(
        file,
        {
          expertiseIds: [SUBJECT_LINES, SPAM_WORDS],
          skillIds: [SUBJECT_IDEAS, WRITE_SUBJECT],
        },
        { user: ALICE }
      );

    it('creates a new item with its version as a draft, at the source number', async () => {
      await importAll();

      const expertise = expertiseOf(SUBJECT_LINES);
      expect(expertise.activeVersion.major).toBeNull();
      expect(draftOf(expertise)).toMatchObject({
        versionMajor: 2,
        versionMinor: 1,
        status: 'DRAFT',
        body:
          '## Length\n\nKeep the subject under 50 characters.\n\n## Tone\n\nOne promise, no shouting.',
      });
    });

    it('opens nothing to the outside, and gives the item to the person importing', async () => {
      await importAll();

      expect(expertiseOf(SUBJECT_LINES)).toMatchObject({
        audience: 'platform',
      });
      expect(skillOf(SUBJECT_IDEAS)).toMatchObject({
        audience: 'platform',
        servedToAssistants: false,
      });
      expect(String(skillOf(WRITE_SUBJECT).owner)).toBe(f.ALICE);
    });

    it('adds a draft beside the active version on an update, which keeps serving', async () => {
      store.seed({
        ...EMPTY_TARGET,
        expertises: [
          {
            ...f.EXPERTISES[0],
            activeVersion: { major: 1, minor: 0 },
            versions: [{ ...f.EXPERTISES[0].versions[0], status: 'ACTIVE' }],
          },
        ],
      });

      const report = await importSkills(
        file,
        { expertiseIds: [SUBJECT_LINES] },
        { user: ALICE }
      );

      const expertise = expertiseOf(SUBJECT_LINES);
      expect(expertise.activeVersion).toEqual({ major: 1, minor: 0 });
      expect(draftOf(expertise)).toMatchObject({
        versionMajor: 2,
        versionMinor: 1,
      });
      expect(report.updated).toEqual([
        { kind: 'expertise', id: SUBJECT_LINES, version: '2.1' },
      ]);
    });

    it('imports only what was chosen, and nothing blocked', async () => {
      store.seed({
        ...EMPTY_TARGET,
        expertises: [{ ...f.EXPERTISES[1], status: 'ARCHIVED' }],
      });

      const report = await importSkills(
        file,
        { expertiseIds: [SUBJECT_LINES, SPAM_WORDS] },
        { user: ALICE }
      );

      expect(report.created.map((item) => item.id)).toEqual([SUBJECT_LINES]);
      expect(report.skipped).toEqual([
        expect.objectContaining({ id: SPAM_WORDS, reason: 'archived' }),
      ]);
      expect(store.stored('skills')).toEqual([]);
    });

    it('imports the expertises before the skills', async () => {
      const report = await importAll();

      expect(report.created.map((item) => item.kind)).toEqual([
        'expertise',
        'expertise',
        'skill',
        'skill',
      ]);
    });

    it('goes on when one item fails, and says which', async () => {
      file.expertises.find((e) => e.expertiseId === SPAM_WORDS).category =
        'not-a-category';

      const report = await importAll();

      expect(report.failed).toEqual([
        expect.objectContaining({ kind: 'expertise', id: SPAM_WORDS }),
      ]);
      expect(report.created.map((item) => item.id)).toEqual([
        SUBJECT_LINES,
        SUBJECT_IDEAS,
        WRITE_SUBJECT,
      ]);
    });

    it('carries the test cases of a feature skill with its version', async () => {
      file.skills.find((s) => s.skillId === SUBJECT_IDEAS).version.testCases = [
        { name: 'Short brief', input: { prompt: 'Sale' } },
      ];

      await importAll();

      expect(draftOf(skillOf(SUBJECT_IDEAS)).testCases).toEqual([
        expect.objectContaining({
          name: 'Short brief',
          input: { prompt: 'Sale' },
        }),
      ]);
    });
  });
});

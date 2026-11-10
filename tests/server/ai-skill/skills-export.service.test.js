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
const skillService = require('../../../packages/server/ai-skill/services/skill.service');
const expertiseService = require('../../../packages/server/ai-skill/services/expertise.service');

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

// The task skill, as a target holds it at an older feature version.
const featureWriteSubject = () => ({
  ...TASK_SKILL,
  activeVersion: { major: 0, minor: 1 },
  versions: [
    {
      ...TASK_SKILL.versions[0],
      nature: 'feature',
      procedure: '',
      consumedExpertiseIds: [],
      versionMajor: 0,
      versionMinor: 1,
    },
  ],
});

const expertiseOf = (id) =>
  store.stored('expertises').find((e) => e.expertiseId === id);
const skillOf = (id) => store.stored('skills').find((s) => s.skillId === id);
const draftOf = (doc) => doc.versions.find((v) => v.status === 'DRAFT');
const itemOf = (preview, id) => preview.items.find((item) => item.id === id);
// The error a call throws, to read its code and what it names.
const refusalOf = (call) => {
  try {
    call();
  } catch (err) {
    return err;
  }
  throw new Error('nothing was refused');
};

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
      await expect(
        exportOf({ expertiseIds: [OLD_RULES] })
      ).rejects.toMatchObject({
        status: 400,
        message: 'SKILLS_EXPORT_ARCHIVED',
        id: OLD_RULES,
      });
      await expect(
        exportOf({ expertiseIds: [DARK_MODE] })
      ).rejects.toMatchObject({
        status: 400,
        message: 'SKILLS_EXPORT_NOT_PUBLISHED',
        id: DARK_MODE,
      });
      await expect(
        exportOf({ skillIds: ['redaction.nowhere'] })
      ).rejects.toMatchObject({
        status: 400,
        message: 'SKILLS_EXPORT_NOT_FOUND',
        id: 'redaction.nowhere',
      });
    });

    it('reads back the file it writes', async () => {
      const file = await exportOf({ all: true });

      expect(readSkillsExport(JSON.parse(JSON.stringify(file)))).toEqual(
        JSON.parse(JSON.stringify(file))
      );
    });

    // A field stored as null, and an account without a name: the file the
    // export writes is one the import reads.
    it('writes a file the import reads, whatever was left empty', async () => {
      store.seed({
        ...SOURCE,
        expertises: SOURCE.expertises.map((e) => ({ ...e, description: null })),
        skills: SOURCE.skills.map((skill) =>
          skill.skillId === SUBJECT_IDEAS
            ? {
                ...skill,
                versions: skill.versions.map((v) => ({
                  ...v,
                  modelHints: { temperature: null, maxTokens: 300 },
                  testCases: [{ name: 'Brief', input: 'Sale', notes: null }],
                })),
              }
            : skill
        ),
      });

      const file = await exportSkills(
        { all: true },
        { user: { id: f.ALICE, email: 'alice@example.com' }, origin: ORIGIN }
      );

      expect(file.exportedBy).toBe('alice@example.com');
      expect(() =>
        readSkillsExport(JSON.parse(JSON.stringify(file)))
      ).not.toThrow();
      expect(
        file.skills.find((s) => s.skillId === SUBJECT_IDEAS).version.modelHints
      ).toEqual({ maxTokens: 300 });
    });

    // The history of an item can be long: an export reads its active
    // version only.
    it('reads the active version of each item, not its history', async () => {
      const find = jest.spyOn(store.models.Expertises, 'find');

      await exportOf({ all: true });
      await exportOf({ expertiseIds: [SUBJECT_LINES] });

      expect(find).toHaveBeenCalled();
      find.mock.calls.forEach(([, projection]) => {
        expect(projection).toMatchObject({
          versions: { $elemMatch: { status: 'ACTIVE' } },
        });
      });
      find.mockRestore();
    });

    it('refuses a file of an unknown format, or that fails validation', () => {
      expect(refusalOf(() => readSkillsExport({ format: 2 }))).toMatchObject({
        status: 400,
        message: 'SKILLS_EXPORT_FORMAT_UNKNOWN',
        format: '2',
        expected: 1,
      });
      expect(
        refusalOf(() =>
          readSkillsExport({ format: 1, expertises: [{ title: 'No id' }] })
        )
      ).toMatchObject({ status: 400, message: 'SKILLS_EXPORT_INVALID' });
    });

    // Refused whole, before the preview, rather than failing item by item.
    it('refuses a file whose content has the wrong type, category or nature', async () => {
      const file = await exportOf({ all: true });
      const broken = (change) => {
        const copy = JSON.parse(JSON.stringify(file));
        change(copy);
        return refusalOf(() => readSkillsExport(copy));
      };

      expect(
        broken((c) => {
          c.skills[1].version.consumedExpertiseIds = SUBJECT_LINES;
        })
      ).toMatchObject({
        message: 'SKILLS_EXPORT_INVALID',
        field: 'skills.1.version.consumedExpertiseIds',
      });
      // As the back office saves them: each once.
      expect(
        broken((c) => {
          c.skills[1].version.consumedExpertiseIds = [
            SUBJECT_LINES,
            SUBJECT_LINES,
          ];
        })
      ).toMatchObject({
        field: 'skills.1.version.consumedExpertiseIds',
        issue: 'names an expertise twice',
      });
      expect(
        broken((c) => {
          c.expertises[0].version.body = {};
        })
      ).toMatchObject({ field: 'expertises.0.version.body' });
      expect(
        broken((c) => {
          c.expertises[0].category = 'not-a-category';
        })
      ).toMatchObject({ field: 'expertises.0.category' });
      expect(
        broken((c) => {
          c.skills[0].version.nature = 'not-a-nature';
        })
      ).toMatchObject({ field: 'skills.0.version.nature' });
      expect(
        broken((c) => {
          c.skills[0].version.testCases = [{ name: 'No input' }];
        })
      ).toMatchObject({ field: 'skills.0.version.testCases.0.input' });
    });

    it('refuses a file whose id is longer than an id may be', async () => {
      const file = await exportOf({ expertiseIds: [SUBJECT_LINES] });
      file.expertises[0].expertiseId = 'a'.repeat(101);

      expect(refusalOf(() => readSkillsExport(file))).toMatchObject({
        message: 'SKILLS_EXPORT_INVALID',
        field: 'expertises.0.expertiseId',
      });
    });

    // zod drops the keys it does not know: a field added to a version and
    // forgotten in the format would be lost on the way.
    it('carries every content field of a version, and no other', () => {
      const {
        VERSION_FIELDS,
      } = require('../../../packages/server/ai-skill/services/skills-export.format');
      const namesOf = (fields) => fields.map(({ name }) => name).sort();

      expect([...VERSION_FIELDS.skill].sort()).toEqual(
        namesOf(skillService.VERSION_CONTENT_FIELDS)
      );
      expect([...VERSION_FIELDS.expertise].sort()).toEqual(
        namesOf(expertiseService.VERSION_CONTENT_FIELDS)
      );
    });

    it('refuses a file that holds an item twice', async () => {
      const file = await exportOf({ expertiseIds: [SUBJECT_LINES] });
      file.expertises.push(file.expertises[0]);

      expect(refusalOf(() => readSkillsExport(file))).toMatchObject({
        message: 'SKILLS_EXPORT_INVALID',
        field: 'expertises.1.expertiseId',
        issue: `"${SUBJECT_LINES}" is in the file twice`,
      });
    });

    it('exports an item chosen twice once', async () => {
      const file = await exportOf({
        expertiseIds: [SUBJECT_LINES, SUBJECT_LINES],
      });

      expect(file.expertises).toHaveLength(1);
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

    // A field the file leaves out reads as its empty value, as here.
    it('says up to date for the same version with a field the file leaves out', async () => {
      delete file.skills.find((s) => s.skillId === WRITE_SUBJECT).version
        .systemPrompt;

      expect(itemOf(await previewImport(file), WRITE_SUBJECT).state).toBe(
        'up_to_date'
      );
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

    // A version can exist here without being the active one: archived after
    // an older draft was published.
    it('blocks a version number that already exists here', async () => {
      store.seed({
        ...SOURCE,
        expertises: SOURCE.expertises.map((e) =>
          e.expertiseId === SPAM_WORDS
            ? {
                ...e,
                activeVersion: { major: 0, minor: 9 },
                versions: [
                  { ...e.versions[0], status: 'ARCHIVED' },
                  { ...e.versions[0], versionMajor: 0, versionMinor: 9 },
                ],
              }
            : e
        ),
      });

      expect(itemOf(await previewImport(file), SPAM_WORDS)).toMatchObject({
        state: 'blocked',
        reason: 'version_exists',
      });
    });

    // The nature is the version's (ADR 0013): a version of another nature is
    // how a skill changes nature, once published.
    it('lets a skill whose nature differs here through, with a warning', async () => {
      store.seed({ ...SOURCE, skills: [featureWriteSubject()] });

      expect(itemOf(await previewImport(file), WRITE_SUBJECT)).toEqual(
        expect.objectContaining({
          state: 'update',
          warnings: [
            { code: 'nature_differs', nature: 'task', current: 'feature' },
          ],
        })
      );
    });

    // The model checks a schema id on every nature.
    it('blocks a task skill that names a schema this instance does not have', async () => {
      store.seed(EMPTY_TARGET);
      file.skills.find(
        (s) => s.skillId === WRITE_SUBJECT
      ).version.inputSchemaId = 'aSchemaFromANewerRelease';

      expect(itemOf(await previewImport(file), WRITE_SUBJECT)).toMatchObject({
        state: 'blocked',
        reason: 'missing_schema',
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

    it('writes a new item with its version alone, never a blank 1.0 beside it', async () => {
      await importAll();

      expect(expertiseOf(SUBJECT_LINES).versions).toEqual([
        expect.objectContaining({ versionMajor: 2, versionMinor: 1 }),
      ]);
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

    // Nothing published in between: each item has the draft the first
    // import opened.
    it('says a draft is open when the same file is imported again', async () => {
      await importAll();

      const again = await importAll();

      expect(again.created).toEqual([]);
      expect(again.updated).toEqual([]);
      expect(again.skipped.map(({ id, reason }) => [id, reason])).toEqual([
        [SPAM_WORDS, 'draft_open'],
        [SUBJECT_LINES, 'draft_open'],
        [SUBJECT_IDEAS, 'draft_open'],
        [WRITE_SUBJECT, 'draft_open'],
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

    it('reads the file once', async () => {
      const {
        FILE,
      } = require('../../../packages/server/ai-skill/services/skills-export.format');
      const safeParse = jest.spyOn(FILE, 'safeParse');

      await importAll();

      expect(safeParse).toHaveBeenCalledTimes(1);
      safeParse.mockRestore();
    });

    it('says which chosen item the file does not hold', async () => {
      const report = await importSkills(
        file,
        { expertiseIds: [SUBJECT_LINES, 'redaction.not-exported'] },
        { user: ALICE }
      );

      expect(report.created.map((item) => item.id)).toEqual([SUBJECT_LINES]);
      expect(report.skipped).toEqual([
        {
          kind: 'expertise',
          id: 'redaction.not-exported',
          reason: 'not_in_file',
        },
      ]);
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

    // The database refuses one document, as a model's validation would.
    it('goes on when one item fails, says which, and leaves nothing of it', async () => {
      const create = store.models.Expertises.create;
      store.models.Expertises.create = async (record) => {
        if (record.expertiseId === SPAM_WORDS) {
          throw new Error('Expertise validation failed');
        }
        return create(record);
      };

      const report = await importAll();
      store.models.Expertises.create = create;

      expect(report.failed).toEqual([
        expect.objectContaining({
          kind: 'expertise',
          id: SPAM_WORDS,
          message: 'Expertise validation failed',
        }),
      ]);
      expect(expertiseOf(SPAM_WORDS)).toBeUndefined();
      expect(report.created.map((item) => item.id)).toEqual([
        SUBJECT_LINES,
        SUBJECT_IDEAS,
        WRITE_SUBJECT,
      ]);
    });

    // What the preview could not know: an expertise of the file left out of
    // the choice, or one whose import failed, is missing as much as one the
    // file does not hold.
    it('warns about a task skill whose expertise is not here once the import is done', async () => {
      const create = store.models.Expertises.create;
      store.models.Expertises.create = async (record) => {
        if (record.expertiseId === SPAM_WORDS) {
          throw new Error('Expertise validation failed');
        }
        return create(record);
      };

      const failed = await importAll();
      store.models.Expertises.create = create;
      store.seed(EMPTY_TARGET);
      const unchosen = await importSkills(
        file,
        { skillIds: [WRITE_SUBJECT] },
        { user: ALICE }
      );

      expect(failed.created.find((i) => i.id === WRITE_SUBJECT)).toEqual({
        kind: 'skill',
        id: WRITE_SUBJECT,
        version: '1.0',
        warnings: [{ code: 'missing_expertises', expertiseIds: [SPAM_WORDS] }],
      });
      expect(unchosen.created[0].warnings).toEqual([
        {
          code: 'missing_expertises',
          expertiseIds: [SUBJECT_LINES, SPAM_WORDS],
        },
      ]);
    });

    it('warns about nothing once every consumed expertise is here', async () => {
      const report = await importAll();

      report.created.forEach((item) => {
        expect(item).not.toHaveProperty('warnings');
      });
    });

    it('imports a version of another nature with its own nature, as a draft', async () => {
      store.seed({ ...EMPTY_TARGET, skills: [featureWriteSubject()] });

      const report = await importSkills(
        file,
        { skillIds: [WRITE_SUBJECT] },
        { user: ALICE }
      );

      const skill = skillOf(WRITE_SUBJECT);
      expect(report.updated).toEqual([
        expect.objectContaining({
          kind: 'skill',
          id: WRITE_SUBJECT,
          version: '1.0',
        }),
      ]);
      expect(skill.activeVersion).toEqual({ major: 0, minor: 1 });
      expect(draftOf(skill)).toMatchObject({ nature: 'task' });
    });

    // A missing consumed expertise warns at the import; the publication still
    // checks each one exists (ADR 0013), so the draft cannot go live without it.
    it('leaves a draft whose consumed expertise is missing unpublishable', async () => {
      store.seed(SOURCE);
      const alone = await exportOf({
        skillIds: [WRITE_SUBJECT],
        withoutExpertiseIds: [SPAM_WORDS],
      });
      store.seed(EMPTY_TARGET);
      await importSkills(
        alone,
        { expertiseIds: [SUBJECT_LINES], skillIds: [WRITE_SUBJECT] },
        { user: ALICE }
      );

      await expect(
        skillService.activateVersion(
          WRITE_SUBJECT,
          { major: 1, minor: 0 },
          { changelog: 'Imported', releaseNotes: 'Imported' },
          f.ALICE
        )
      ).rejects.toMatchObject({
        status: 400,
        message: 'SKILL_CONSUMED_EXPERTISES_NOT_FOUND',
        expertiseIds: [SPAM_WORDS],
      });
      expect(skillOf(WRITE_SUBJECT).activeVersion.major).toBeNull();
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

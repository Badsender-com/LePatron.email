'use strict';

// An imported version on the real schemas (ADR 0018): the fake models of the
// other import tests validate nothing, so what the models refuse or derive
// is checked here. There is no database: each model answers from memory,
// and every document it gives or takes is a real one, validated as a save
// or a creation would validate it.

const mongoose = require('mongoose');
const LePatronSkillSchema = require('../../../../packages/server/ai-skill/models/le-patron-skill.schema');
const ExpertiseSchema = require('../../../../packages/server/ai-skill/models/expertise.schema');

const SkillModel =
  mongoose.models.__ImportedSkill ||
  mongoose.model('__ImportedSkill', LePatronSkillSchema);
const ExpertiseModel =
  mongoose.models.__ImportedExpertise ||
  mongoose.model('__ImportedExpertise', ExpertiseSchema);

const copy = (value) => JSON.parse(JSON.stringify(value));

// What the services ask of a model, on stored records: equality, `$in`,
// `$ne` and `$size`, as MongoDB reads them.
function matches(record, filter) {
  return Object.entries(filter).every(([key, condition]) => {
    const value = record[key];
    if (condition && typeof condition === 'object') {
      if ('$in' in condition) return condition.$in.includes(value);
      if ('$ne' in condition) return value !== condition.$ne;
      if ('$size' in condition) return value.length === condition.$size;
      throw new Error(`imported-draft test: ${JSON.stringify(condition)}`);
    }
    return value === condition;
  });
}

function inMemory(Model) {
  const records = [];
  const find = (filter) => records.find((record) => matches(record, filter));
  return {
    records,
    seed(record) {
      records.splice(0, Infinity, copy(new Model(record).toObject()));
    },
    async create(payload) {
      const doc = new Model(payload);
      await doc.validate();
      records.push(copy(doc.toObject()));
      return doc;
    },
    async findOne(filter) {
      const record = find(filter);
      return record ? Model.hydrate(copy(record)) : null;
    },
    find: (filter) => ({
      lean: async () => records.filter((r) => matches(r, filter)).map(copy),
    }),
    // A `$push`, cast as Mongoose casts an update, and no hook run.
    async findOneAndUpdate(filter, { $push }) {
      const record = find(filter);
      if (!record) return null;
      const cast = new Model({ ...record, versions: [$push.versions] });
      record.versions.push(copy(cast.toObject().versions[0]));
      return Model.hydrate(copy(record));
    },
  };
}

const skills = inMemory(SkillModel);
const expertises = inMemory(ExpertiseModel);
jest.doMock('../../../../packages/server/common/models.common.js', () => ({
  LePatronSkills: skills,
  Expertises: expertises,
}));
jest.doMock('../../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const expertiseService = require('../../../../packages/server/ai-skill/services/expertise.service');
const {
  importSkills,
} = require('../../../../packages/server/ai-skill/services/skills-export.service');

const USER = { id: '507f1f77bcf86cd799439101' };
const SKILL_ID = 'redaction.write-subject';
const EXPERTISE_ID = 'redaction.subject-line';

const TASK = {
  nature: 'task',
  procedure: '## Steps\n\n1. Read the brief.\n2. Write three subjects.',
};
const FEATURE = {
  nature: 'feature',
  systemPrompt: 'You write email subject lines for a brand.',
  inputTemplate: 'Brief: {{input.prompt}}',
  inputSchemaId: 'genericTextInput',
  outputSchemaId: 'genericTextOutput',
};

// A skill here, its 1.0 active, of the content given.
const skillHere = (content) => ({
  skillId: SKILL_ID,
  title: 'Write a subject line',
  category: 'redaction',
  status: 'ACTIVE',
  activeVersion: { major: 1, minor: 0 },
  versions: [
    { versionMajor: 1, versionMinor: 0, status: 'ACTIVE', ...content },
  ],
});

const fileOf = ({
  skills: inFile = [],
  expertises: expertisesInFile = [],
}) => ({
  format: 1,
  origin: 'https://source.lepatron.example',
  exportedAt: '2026-11-10T08:00:00.000Z',
  exportedBy: 'Alice',
  expertises: expertisesInFile,
  skills: inFile,
});

const skillInFile = (content) => ({
  skillId: SKILL_ID,
  title: 'Write a subject line',
  category: 'redaction',
  version: { major: 2, minor: 0, ...content },
});

const draftHere = () =>
  skills.records[0].versions.find((v) => v.status === 'DRAFT');

describe('an imported version, on the real schemas', () => {
  beforeEach(() => {
    skills.records.splice(0);
    expertises.records.splice(0);
  });

  // A refused version leaves nothing behind: the document is created with
  // it, in one write the model validates.
  it('creates nothing when the model refuses the imported version', async () => {
    await expect(
      skillService.createSkill(
        {
          skillId: SKILL_ID,
          title: 'Write a subject line',
          category: 'redaction',
        },
        USER.id,
        {},
        {
          initialVersion: {
            versionMajor: 2,
            versionMinor: 1,
            ...FEATURE,
            inputSchemaId: 'aSchemaFromANewerRelease',
          },
        }
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(skills.records).toEqual([]);
  });

  // A conditioned update runs no hook: the version is validated before.
  it('writes no draft the model refuses on an update', async () => {
    skills.seed(skillHere(FEATURE));

    await expect(
      skillService.createVersionAt(
        SKILL_ID,
        { major: 2, minor: 0 },
        { ...FEATURE, systemPrompt: 'Answer {{input.prompt}}' },
        USER.id
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(skills.records[0].versions).toHaveLength(1);
  });

  it('derives the sections of an expertise imported as an update', async () => {
    expertises.seed({
      expertiseId: EXPERTISE_ID,
      title: 'Subject lines',
      category: 'redaction',
      status: 'ACTIVE',
      activeVersion: { major: 1, minor: 0 },
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          status: 'ACTIVE',
          body: '## Length\n\nUnder 60 characters.',
        },
      ],
    });

    await expertiseService.createVersionAt(
      EXPERTISE_ID,
      { major: 2, minor: 0 },
      {
        body:
          '## [length] Length\n\nUnder 50 characters.\n\n## [tone] Tone\n\nOne promise.',
      },
      USER.id
    );

    const draft = expertises.records[0].versions[1];
    expect(draft.sections.map((section) => section.id)).toEqual([
      'length',
      'tone',
    ]);
  });

  // The nature is the version's (ADR 0013): a version of the other nature
  // arrives as a draft, in both directions, never as a failure.
  describe.each([
    ['a feature version, with its template', TASK, FEATURE],
    [
      'a feature version without a template',
      TASK,
      { nature: 'feature', systemPrompt: 'You write subject lines.' },
    ],
    ['a task version', FEATURE, TASK],
  ])('%s, onto a skill of the other nature', (_label, here, imported) => {
    it('is imported as a draft of its own nature, with a warning', async () => {
      skills.seed(skillHere(here));

      const report = await importSkills(
        fileOf({ skills: [skillInFile(imported)] }),
        { skillIds: [SKILL_ID] },
        { user: USER }
      );

      expect(report.failed).toEqual([]);
      expect(report.updated).toEqual([
        expect.objectContaining({
          id: SKILL_ID,
          version: '2.0',
          warnings: [
            {
              code: 'nature_differs',
              nature: imported.nature,
              current: here.nature,
            },
          ],
        }),
      ]);
      expect(draftHere()).toMatchObject({
        versionMajor: 2,
        versionMinor: 0,
        ...imported,
      });
      expect(skills.records[0].activeVersion).toEqual({ major: 1, minor: 0 });
    });
  });
});

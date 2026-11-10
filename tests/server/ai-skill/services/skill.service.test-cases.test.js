/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Test cases live in a feature skill's version (ADR 0019, #1429): written
// on a draft through the version update, refused with a clear error when a
// case misses what it needs, and carried by a new version from its source.

const { createMcpStore } = require('../../../helpers/mcp-fake-models');

const store = createMcpStore();
jest.doMock(
  '../../../../packages/server/common/models.common.js',
  () => store.models
);

const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const ERROR_CODES = require('../../../../packages/server/constant/error-codes');
const f = require('../../../helpers/mcp-fixtures');

const SUBJECT_IDEAS = 'redaction.subject-ideas';
const USER = f.ALICE;
const CASE = {
  name: 'A winter sale',
  input: { prompt: 'Winter sale', context: '' },
  expectedOutput: 'Three subject lines that name the sale',
  notes: 'From a golden run',
};

const ACTIVE = f.SKILLS[0].versions[0];
const subjectIdeas = {
  ...f.SKILLS[0],
  versions: [
    { ...ACTIVE, testCases: [CASE] },
    {
      ...ACTIVE,
      versionMinor: 3,
      status: 'DRAFT',
      testCases: [],
      changelog: '',
      releaseNotes: '',
    },
  ],
};

const DRAFT = { major: 1, minor: 3 };
const versionOf = async (major, minor) =>
  (await skillService.getSkill(SUBJECT_IDEAS)).versions.find(
    (v) => v.versionMajor === major && v.versionMinor === minor
  );

beforeEach(() => store.seed({ skills: [subjectIdeas] }));

describe("Test cases on a feature skill's version", () => {
  it('a draft takes test cases through the version update', async () => {
    await skillService.updateVersion(
      SUBJECT_IDEAS,
      DRAFT,
      { testCases: [CASE, { name: 'Empty brief', input: { prompt: '' } }] },
      USER
    );

    expect((await versionOf(1, 3)).testCases).toEqual([
      CASE,
      { name: 'Empty brief', input: { prompt: '' } },
    ]);
  });

  it.each([
    ['without a name', { input: { prompt: 'x' } }],
    ['with a blank name', { name: '  ', input: { prompt: 'x' } }],
    ['without an input', { name: 'No input' }],
    ['with a null input', { name: 'No input', input: null }],
  ])('refuses a case %s, with a 400 naming it', async (_label, testCase) => {
    const update = skillService.updateVersion(
      SUBJECT_IDEAS,
      DRAFT,
      { testCases: [CASE, testCase] },
      USER
    );

    await expect(update).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.SKILL_TEST_CASE_INVALID,
      index: 1,
    });
    expect((await versionOf(1, 3)).testCases).toEqual([]);
  });

  // No feature calls a task skill: its version holds no test case.
  it('refuses test cases on a task version, and a task nature on a version that has some', async () => {
    store.seed({
      skills: [
        {
          ...subjectIdeas,
          versions: subjectIdeas.versions.map((v) =>
            v.status === 'DRAFT' ? { ...v, nature: 'task' } : v
          ),
        },
      ],
    });
    const refused = {
      status: 400,
      message: ERROR_CODES.SKILL_TEST_CASES_ON_TASK,
    };

    await expect(
      skillService.updateVersion(
        SUBJECT_IDEAS,
        DRAFT,
        { testCases: [CASE] },
        USER
      )
    ).rejects.toMatchObject(refused);
    await skillService.updateVersion(
      SUBJECT_IDEAS,
      DRAFT,
      { nature: 'feature', testCases: [CASE] },
      USER
    );
    await expect(
      skillService.updateVersion(SUBJECT_IDEAS, DRAFT, { nature: 'task' }, USER)
    ).rejects.toMatchObject(refused);
    expect((await versionOf(1, 3)).testCases).toEqual([CASE]);
  });

  it('refuses test cases that are not a list', async () => {
    await expect(
      skillService.updateVersion(
        SUBJECT_IDEAS,
        DRAFT,
        { testCases: CASE },
        USER
      )
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.SKILL_TEST_CASE_INVALID,
    });
  });

  it('keeps the test cases of an active version unchanged', async () => {
    await expect(
      skillService.updateVersion(
        SUBJECT_IDEAS,
        { major: 1, minor: 2 },
        { testCases: [] },
        USER
      )
    ).rejects.toMatchObject({ status: 409 });
    expect((await versionOf(1, 2)).testCases).toEqual([CASE]);
  });

  it('a new version starts with the test cases of its source', async () => {
    store.seed({
      skills: [{ ...subjectIdeas, versions: [subjectIdeas.versions[0]] }],
    });

    await skillService.createMinorVersion(SUBJECT_IDEAS, USER);
    await skillService.createMajorVersion(SUBJECT_IDEAS, { userId: USER });

    expect((await versionOf(1, 3)).testCases).toEqual([CASE]);
    expect((await versionOf(2, 0)).testCases).toEqual([CASE]);
  });
});

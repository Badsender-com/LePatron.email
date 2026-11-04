'use strict';

// A feature skill's test cases (ADR 0019, #1429): the form that writes one,
// and the playground run that becomes one, in the open draft only.
const {
  emptyTestCaseForm,
  testCaseToForm,
  formToTestCase,
  testCaseFromRun,
  openDraftOf,
  addRunAsTestCase,
} = require('../../../packages/ui/helpers/ai-skill-test-cases');

const CASE = {
  name: 'A winter sale',
  input: { prompt: 'Winter sale', context: '' },
  expectedOutput: 'Names the sale',
  notes: 'From a golden run',
};

const version = (major, minor, status, testCases = []) => ({
  versionMajor: major,
  versionMinor: minor,
  status,
  testCases,
});

const RUN = {
  _id: 'run-1',
  status: 'SUCCESS',
  scenarioSnapshot: { name: 'Winter sale brief', input: { prompt: 'Winter' } },
  resolvedSkill: { skillId: 'redaction.subject-ideas' },
  composedInput: {
    prompt: 'Winter sale',
    context: '',
    expertise: [{ expertiseId: 'redaction.subject-lines', body: '…' }],
  },
  output: { text: 'Three subject lines' },
};

describe('the test case form', () => {
  it('starts empty, with an empty JSON object as input', () => {
    expect(emptyTestCaseForm()).toEqual({
      name: '',
      input: '{}',
      expectedOutput: '',
      notes: '',
    });
  });

  it('shows a case with its input as indented JSON', () => {
    expect(testCaseToForm(CASE)).toEqual({
      name: 'A winter sale',
      input: JSON.stringify(CASE.input, null, 2),
      expectedOutput: 'Names the sale',
      notes: 'From a golden run',
    });
  });

  it('shows a structured expected output as JSON, and missing fields empty', () => {
    const form = testCaseToForm({
      name: 'n',
      input: {},
      expectedOutput: { a: 1 },
    });
    expect(form.expectedOutput).toBe('{\n  "a": 1\n}');
    expect(form.notes).toBe('');
  });

  it('gives back the case written in the form', () => {
    expect(formToTestCase(testCaseToForm(CASE))).toEqual({
      testCase: CASE,
      errors: {},
    });
  });

  it('trims the name and leaves out what was not written', () => {
    expect(
      formToTestCase({
        name: '  Short ',
        input: '{"prompt":"x"}',
        expectedOutput: ' ',
        notes: '',
      })
    ).toEqual({
      testCase: { name: 'Short', input: { prompt: 'x' } },
      errors: {},
    });
  });

  it.each([
    ['a blank name', { name: ' ', input: '{}' }, { name: 'required' }],
    ['an empty input', { name: 'n', input: '  ' }, { input: 'required' }],
    [
      'an input that is not JSON',
      { name: 'n', input: '{prompt:' },
      { input: 'invalidJson' },
    ],
    [
      'an input that is not an object',
      { name: 'n', input: '[1]' },
      { input: 'notObject' },
    ],
    ['a null input', { name: 'n', input: 'null' }, { input: 'notObject' }],
  ])('refuses %s, before anything is saved', (_label, form, errors) => {
    expect(formToTestCase(form)).toEqual({ testCase: null, errors });
  });
});

describe('a playground run as a test case', () => {
  it('takes the input the skill received, without the expertises the replay loads itself', () => {
    expect(testCaseFromRun(RUN, { notes: 'From the playground' })).toEqual({
      name: 'Winter sale brief',
      input: { prompt: 'Winter sale', context: '' },
      expectedOutput: '{\n  "text": "Three subject lines"\n}',
      notes: 'From the playground',
    });
  });

  it('keeps a text output as it is', () => {
    expect(testCaseFromRun({ ...RUN, output: 'Plain' }).expectedOutput).toBe(
      'Plain'
    );
  });

  it('falls back on the scenario input and the skill id', () => {
    const run = {
      ...RUN,
      composedInput: undefined,
      scenarioSnapshot: { input: { prompt: 'Winter' } },
    };
    expect(testCaseFromRun(run)).toMatchObject({
      name: 'redaction.subject-ideas',
      input: { prompt: 'Winter' },
    });
  });
});

describe('the open draft of a skill', () => {
  it('is the latest draft ahead of the active version', () => {
    const skill = {
      activeVersion: { major: 2, minor: 0 },
      versions: [
        version(1, 1, 'DRAFT'),
        version(2, 0, 'ACTIVE'),
        version(2, 1, 'DRAFT'),
        version(3, 0, 'DRAFT'),
      ],
    };
    expect(openDraftOf(skill)).toBe(skill.versions[3]);
  });

  it('is any draft when nothing is published yet', () => {
    const skill = {
      activeVersion: { major: null },
      versions: [version(1, 0, 'DRAFT')],
    };
    expect(openDraftOf(skill)).toBe(skill.versions[0]);
  });

  it('is none when only the active and archived versions remain', () => {
    const skill = {
      activeVersion: { major: 1, minor: 1 },
      versions: [version(1, 0, 'ARCHIVED'), version(1, 1, 'ACTIVE')],
    };
    expect(openDraftOf(skill)).toBeNull();
  });
});

describe('adding a run to the test cases of the open draft', () => {
  const featureSkill = (versions) => ({
    nature: 'feature',
    activeVersion: { major: 1, minor: 0 },
    versions,
  });

  it('appends the case to the draft, after the cases it has', () => {
    const draft = version(1, 1, 'DRAFT', [CASE]);
    const skill = featureSkill([version(1, 0, 'ACTIVE'), draft]);

    const result = addRunAsTestCase(skill, RUN);

    expect(result.outcome).toBe('added');
    expect(result.draft).toBe(draft);
    expect(result.testCases).toEqual([CASE, testCaseFromRun(RUN)]);
    expect(draft.testCases).toEqual([CASE]);
  });

  it('never writes in the active version when there is no open draft', () => {
    const skill = featureSkill([version(1, 0, 'ACTIVE', [CASE])]);
    expect(addRunAsTestCase(skill, RUN)).toEqual({ outcome: 'noDraft' });
  });

  it('refuses a task skill, which has no test case', () => {
    const skill = { ...featureSkill([version(1, 1, 'DRAFT')]), nature: 'task' };
    expect(addRunAsTestCase(skill, RUN)).toEqual({ outcome: 'taskSkill' });
  });

  it('refuses a run that did not succeed', () => {
    const skill = featureSkill([version(1, 1, 'DRAFT')]);
    expect(addRunAsTestCase(skill, { ...RUN, status: 'ERROR' })).toEqual({
      outcome: 'runFailed',
    });
  });
});

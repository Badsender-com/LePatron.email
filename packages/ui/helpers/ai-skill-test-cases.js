// A feature skill's test cases (ADR 0019): the rules of the form that writes
// one, and of the playground run that becomes one. The components only show
// them; the rules live here so they are tested without mounting anything.

const JSON_INDENT = 2;

const asText = (value) => {
  if (value === undefined || value === null) return '';
  return typeof value === 'string'
    ? value
    : JSON.stringify(value, null, JSON_INDENT);
};

const isPlainObject = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function emptyTestCaseForm() {
  return { name: '', input: '{}', expectedOutput: '', notes: '' };
}

// The input is edited as JSON; the expected output and the notes as text.
export function testCaseToForm(testCase) {
  return {
    name: testCase.name || '',
    input: JSON.stringify(testCase.input ?? {}, null, JSON_INDENT),
    expectedOutput: asText(testCase.expectedOutput),
    notes: testCase.notes || '',
  };
}

function parseInput(text) {
  const source = String(text || '').trim();
  if (!source) return { error: 'required' };
  let value;
  try {
    value = JSON.parse(source);
  } catch (err) {
    return { error: 'invalidJson' };
  }
  // A skill's input is an object of named fields, as its input schema says.
  return isPlainObject(value) ? { value } : { error: 'notObject' };
}

/**
 * @returns {{testCase: Object|null, errors: Object}} the case to save, or the
 *   errors by field (`required`, `invalidJson`, `notObject`), each a key of
 *   `aiSkills.testCases.errors` in the locales
 */
export function formToTestCase(form) {
  const errors = {};
  const name = String(form.name || '').trim();
  if (!name) errors.name = 'required';
  const input = parseInput(form.input);
  if (input.error) errors.input = input.error;
  if (Object.keys(errors).length) return { testCase: null, errors };

  const testCase = { name, input: input.value };
  const expectedOutput = String(form.expectedOutput || '').trim();
  if (expectedOutput) testCase.expectedOutput = form.expectedOutput;
  const notes = String(form.notes || '').trim();
  if (notes) testCase.notes = form.notes;
  return { testCase, errors: {} };
}

/**
 * The run's input as the skill received it, without the expertises the
 * runner added: a replay loads them itself, in the version being checked.
 * Its output becomes the expected output, for the person to reread.
 */
export function testCaseFromRun(run, { notes } = {}) {
  const snapshot = run.scenarioSnapshot || {};
  const composed = isPlainObject(run.composedInput) ? run.composedInput : null;
  const { expertise: _loadedByTheReplay, ...input } =
    composed || snapshot.input || {};
  const testCase = {
    name: snapshot.name || (run.resolvedSkill && run.resolvedSkill.skillId),
    input,
    expectedOutput: asText(run.output),
  };
  if (notes) testCase.notes = notes;
  return testCase;
}

const isAfter = (a, b) =>
  a.versionMajor > b.versionMajor ||
  (a.versionMajor === b.versionMajor && a.versionMinor > b.versionMinor);

// The server's rule (version-helpers.js): the latest draft ahead of the
// active version, or any draft while nothing is published.
export function openDraftOf(skill) {
  const ref = skill.activeVersion || {};
  const active =
    ref.major == null
      ? null
      : { versionMajor: ref.major, versionMinor: ref.minor || 0 };
  return (skill.versions || [])
    .filter((v) => v.status === 'DRAFT' && (!active || isAfter(v, active)))
    .reduce((latest, v) => (!latest || isAfter(v, latest) ? v : latest), null);
}

/**
 * Where a playground run goes as a test case. An active version never
 * changes, so without an open draft nothing is written.
 *
 * @returns {{outcome: 'added', draft: Object, testCases: Array}
 *   | {outcome: 'noDraft'|'taskSkill'|'runFailed'}}
 */
export function addRunAsTestCase(skill, run, { notes } = {}) {
  if (skill.nature === 'task') return { outcome: 'taskSkill' };
  if (run.status !== 'SUCCESS') return { outcome: 'runFailed' };
  const draft = openDraftOf(skill);
  if (!draft) return { outcome: 'noDraft' };
  return {
    outcome: 'added',
    draft,
    testCases: [...(draft.testCases || []), testCaseFromRun(run, { notes })],
  };
}

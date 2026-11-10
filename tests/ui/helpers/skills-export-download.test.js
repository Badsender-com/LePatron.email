/**
 * @jest-environment jsdom
 */
'use strict';

// An export the server refuses says why (ADR 0018): the file is asked for as
// a blob, and so comes the body of an error, read back for its reason. The
// words of the failure, in both languages.

const {
  downloadSkillsExport,
  exportFailureMessage,
} = require('~/helpers/skills-export-download.js');
const fr = require('~/helpers/locales/fr.js').default;
const en = require('~/helpers/locales/en.js').default;

const refusedWith = (body) =>
  Object.assign(new Error('Request failed with status code 400'), {
    response: { status: 400, data: new Blob([body]) },
  });

const failing = (err) => ({ post: jest.fn().mockRejectedValue(err) });

// `$t` echoes an unknown key back, as vue-i18n does; the words of the export
// show what they are filled with.
const vm = (entries = {}) => ({
  $t: (key, params) => {
    if (key in entries) return entries[key];
    return key.startsWith('aiSkills.export.') && params
      ? `${key} ${JSON.stringify(params)}`
      : key;
  },
});

async function failureOf(err, entries) {
  const thrown = await downloadSkillsExport(failing(err), { all: true }).catch(
    (e) => e
  );
  return exportFailureMessage(vm(entries), thrown);
}

describe('an export the server refuses', () => {
  it('gives the reason the server sends', async () => {
    const text = await failureOf(
      refusedWith(JSON.stringify({ message: '"qc.review" is archived.' }))
    );
    expect(text).toBe(
      'aiSkills.export.failedBecause {"reason":"\\"qc.review\\" is archived."}'
    );
  });

  it('gives the reason in words when the server sends a known code', async () => {
    const text = await failureOf(
      refusedWith(JSON.stringify({ message: 'SOME_CODE' })),
      { 'aiSkills.errors.SOME_CODE': 'In words' }
    );
    expect(text).toBe('aiSkills.export.failedBecause {"reason":"In words"}');
  });

  it('says only that it failed when the body is not readable', async () => {
    expect(await failureOf(refusedWith('<html>Bad gateway</html>'))).toBe(
      'aiSkills.export.failed'
    );
  });

  it('says only that it failed when no answer came', async () => {
    expect(await failureOf(new Error('Network Error'))).toBe(
      'aiSkills.export.failed'
    );
  });
});

describe.each([
  ['fr', fr],
  ['en', en],
])('the words of a failed export, in %s', (_lang, messages) => {
  it('give the reason', () => {
    expect(messages.aiSkills.export.failedBecause).toContain('{reason}');
  });
});

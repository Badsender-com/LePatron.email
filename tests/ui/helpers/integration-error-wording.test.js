'use strict';

const fs = require('fs');
const path = require('path');

const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const fr = require('../../../packages/ui/helpers/locales/fr').default;
const en = require('../../../packages/ui/helpers/locales/en').default;

// The integrations tab shows `integrations.errors.<code>` for a failed save,
// and a generic "an error occurred" when there is no wording. So a code the
// save path can throw without wording reads as an unexplained failure — which
// is what happened to INTEGRATION_NAME_ALREADY_EXIST, the most common one.
const SAVE_PATH = [
  'packages/server/integration/integration.service.js',
  'packages/server/integration/integration.validation.js',
];
// Thrown on that path, but not by a save.
const NOT_SAVE_ERRORS = ['FAILED_INTEGRATION_DELETE'];

function codesThrownOnSavePath() {
  const names = new Set();
  for (const file of SAVE_PATH) {
    const source = fs.readFileSync(
      path.join(__dirname, '../../..', file),
      'utf8'
    );
    for (const [, name] of source.matchAll(/ERROR_CODES\.([A-Z_]+)/g)) {
      if (!NOT_SAVE_ERRORS.includes(name)) names.add(name);
    }
  }
  return [...names].map((name) => ERROR_CODES[name]);
}

describe('integration save errors', () => {
  const codes = codesThrownOnSavePath();

  it('finds the codes it checks', () => {
    expect(codes).toContain('INTEGRATION_NAME_ALREADY_EXIST');
  });

  it.each(codes)('%s has wording in fr and en', (code) => {
    expect(fr.integrations.errors[code]).toEqual(expect.any(String));
    expect(en.integrations.errors[code]).toEqual(expect.any(String));
  });
});

'use strict';

const {
  saveErrorKeyFor,
  SAVE_ERROR_KEYS,
} = require('../../../packages/editor/src/js/ext/html-code-block/save-error.js');
const SERVER_ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const fr = require('../../../public/lang/badsender-fr.js');
const en = require('../../../public/lang/badsender-en.js');

// A refused save used to read "an error occurred", with nothing saying the
// template flag or a size limit was the reason.
describe('saveErrorKeyFor', () => {
  it.each(Object.keys(SAVE_ERROR_KEYS))('names the reason for %s', (code) => {
    expect(saveErrorKeyFor({ responseJSON: { message: code } })).toBe(
      SAVE_ERROR_KEYS[code]
    );
  });

  it('leaves any other refusal to the generic message', () => {
    expect(saveErrorKeyFor({ responseJSON: { message: 'OTHER' } })).toBeNull();
    expect(
      saveErrorKeyFor({ responseJSON: { message: 'toString' } })
    ).toBeNull();
    expect(saveErrorKeyFor({})).toBeNull();
    expect(saveErrorKeyFor(undefined)).toBeNull();
  });

  // A code renamed on one side would silently fall back to the generic message.
  it.each(Object.keys(SAVE_ERROR_KEYS))('%s exists server-side', (code) => {
    expect(SERVER_ERROR_CODES[code]).toBe(code);
  });

  it.each(Object.values(SAVE_ERROR_KEYS))('%s is translated', (key) => {
    expect(fr[key]).toEqual(expect.any(String));
    expect(en[key]).toEqual(expect.any(String));
  });
});

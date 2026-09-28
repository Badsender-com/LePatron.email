import { ERROR_CODES } from '~/helpers/constants/error-codes.js';

const SERVER_ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

/**
 * The UI copies the error codes it reacts to, because it has no import path into
 * the server package at runtime. Each block carries a "KEEP IN SYNC" comment, and
 * a comment has never kept anything in sync: a code renamed server-side simply
 * stops matching, the `switch` in helpers/taxonomy.js falls through to its
 * default, and the user reads "Une erreur est survenue" instead of the message
 * that tells them what to do. Nothing throws, so nothing else catches it.
 */
describe('UI error codes', () => {
  // Every key is its own value on both sides, so a typo on either one shows up
  // as a mismatch rather than as a silently unused constant.
  it.each(Object.keys(ERROR_CODES))('%s is its own value', (key) => {
    expect(ERROR_CODES[key]).toBe(key);
  });

  // Pre-existing drift, recorded rather than hidden: these two have no
  // counterpart in packages/server/constant/error-codes.js. They predate the
  // taxonomy work — left alone here, but they must not grow a third sibling
  // without someone noticing.
  const KNOWN_ORPHANS = ['NOT_AUTHORIZED_ESP', 'API_PROVIDER_NOT_DEFINED'];

  const sharedCodes = Object.keys(ERROR_CODES).filter(
    (key) => !KNOWN_ORPHANS.includes(key)
  );

  it.each(sharedCodes)('%s exists server-side with the same value', (key) => {
    expect(SERVER_ERROR_CODES[key]).toBe(ERROR_CODES[key]);
  });

  it('has not grown a new code the server does not know', () => {
    const orphans = Object.keys(ERROR_CODES).filter(
      (key) => SERVER_ERROR_CODES[key] === undefined
    );
    expect(orphans.sort()).toEqual([...KNOWN_ORPHANS].sort());
  });
});

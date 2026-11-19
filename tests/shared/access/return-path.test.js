'use strict';

// Where the login may send a user back (ADR 0012): the consent page of a
// connected application, and nothing a link could turn into an open
// redirection.

const {
  isReturnPath,
  samlReturnPath,
} = require('../../../packages/shared/access/return-path.js');

describe('isReturnPath', () => {
  it('accepts the consent page of a connection', () => {
    expect(isReturnPath('/oauth/consent/Ab3_x-Y9')).toBe(true);
  });

  it.each([
    ['another site', 'https://elsewhere.example.test/oauth/consent/abc'],
    ['a protocol-relative URL', '//elsewhere.example.test/oauth/consent/abc'],
    ['another page of the app', '/groups'],
    ['a path past the consent page', '/oauth/consent/abc/../../groups'],
    ['a query string', '/oauth/consent/abc?next=https://elsewhere'],
    ['nothing', undefined],
  ])('refuses %s', (_case, path) => {
    expect(isReturnPath(path)).toBe(false);
  });
});

// The identity provider posts its answer cross-site, where the session's lax
// cookie does not travel: the path comes back as the RelayState.
describe('samlReturnPath', () => {
  const CONSENT = '/oauth/consent/abc-123';

  it('takes the path the identity provider sent back', () => {
    expect(samlReturnPath(CONSENT, undefined)).toBe(CONSENT);
  });

  it("falls back on the session's, when the provider sent none", () => {
    expect(samlReturnPath(undefined, CONSENT)).toBe(CONSENT);
  });

  it('never sends anywhere else, whoever wrote the RelayState', () => {
    expect(samlReturnPath('https://evil.example/', undefined)).toBeUndefined();
    expect(samlReturnPath('//evil.example', CONSENT)).toBe(CONSENT);
  });
});

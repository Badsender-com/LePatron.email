'use strict';

// Where the login may send a user back (ADR 0012): the consent page of a
// connected application, and nothing a link could turn into an open
// redirection.

const {
  isReturnPath,
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

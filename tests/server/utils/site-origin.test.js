'use strict';

// The site's public origin: the links of the emails, and the issuer of the
// MCP authorization server, which no longer reads it from the emails.

const originWith = (config) => {
  jest.resetModules();
  jest.doMock('../../../packages/server/node.config.js', () => config);
  return require('../../../packages/server/utils/site-origin.js').siteOrigin();
};

describe('the site origin', () => {
  afterEach(() => {
    jest.dontMock('../../../packages/server/node.config.js');
  });

  it('is in https outside development', () => {
    expect(originWith({ isDev: false, host: 'app.example.test' })).toBe(
      'https://app.example.test'
    );
  });

  it('is in plain http on a developer machine', () => {
    expect(originWith({ isDev: true, host: 'localhost:3000' })).toBe(
      'http://localhost:3000'
    );
  });

  it('is the one the emails link to', () => {
    jest.resetModules();
    const fromEmails = require('../../../packages/server/email-templates/email-template.js')
      .siteOrigin;
    const fromUtils = require('../../../packages/server/utils/site-origin.js')
      .siteOrigin;

    expect(fromEmails).toBe(fromUtils);
  });
});

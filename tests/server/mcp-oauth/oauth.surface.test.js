/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// What the authorization server answers anyone who calls it (ADR 0012): only
// the endpoints an assistant uses, small bodies, and its own pages.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');

describe('the surface of the authorization server', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  it.each([
    ['a registration', '/oauth/reg', 'json'],
    ['a token request', '/oauth/token', 'form'],
  ])('refuses %s larger than 64 KB', async (_case, path, type) => {
    const response = await request(app)
      .post(path)
      .type(type)
      .send({ client_name: 'x'.repeat(70 * 1024) });

    expect(response.status).toBe(413);
  });
});

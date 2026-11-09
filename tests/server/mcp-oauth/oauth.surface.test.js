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

// `lepatron_mcpOauthJwks` is required, though nothing is signed today. The
// day one of these fails, the keys of that variable sign what is issued:
// they must then be kept, the same on every instance and across deployments.
describe('what the keys of lepatron_mcpOauthJwks sign', () => {
  const { jwksOf } = require('../../../packages/server/mcp/mcp-oauth.js');
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  it('nothing: the access token is opaque, not a signed JWT', async () => {
    const f = require('../../helpers/mcp-fixtures');
    const tokens = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });

    expect(tokens.access_token).toEqual(expect.any(String));
    expect(tokens.access_token.split('.')).toHaveLength(1);
    expect(tokens.id_token).toBeUndefined();
  });

  it('nothing: no ID token, the openid scope is refused', async () => {
    const response = await request(app)
      .get('/oauth/auth')
      .query(
        oauth.authorizeQuery(oauth.CIMD_CLIENT, oauth.pkce().challenge, {
          scope: 'openid mcp:read',
        })
      );

    expect(new URL(response.headers.location).searchParams.get('error')).toBe(
      'invalid_scope'
    );
  });

  it('reads a key set', () => {
    const jwks = { keys: [{ kty: 'RSA', kid: 'one' }] };

    expect(jwksOf(JSON.stringify(jwks))).toEqual(jwks);
  });

  it.each([
    ['text that is not JSON', '{"keys": [{"d": "a-private-part"'],
    ['JSON that is no key set', '{"kty": "RSA"}'],
    ['a set without keys', '{"keys": []}'],
  ])('refuses %s, naming the variable and never its value', (_case, text) => {
    const failure = (() => {
      try {
        return jwksOf(text);
      } catch (error) {
        return error;
      }
    })();

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toMatch(/lepatron_mcpOauthJwks/);
    expect(failure.message).not.toContain('a-private-part');
  });
});

describe('what the authorization server offers', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  it.each([
    ['signing the user out', '/oauth/session/end'],
    ["reading the user's profile", '/oauth/me'],
  ])('does not offer %s', async (_case, path) => {
    const response = await request(app).get(path);
    const { body } = await request(app).get(
      '/.well-known/oauth-authorization-server/oauth'
    );

    expect(response.status).toBe(404);
    expect(body.end_session_endpoint).toBeUndefined();
    expect(body.userinfo_endpoint).toBeUndefined();
  });

  it('takes no pushed authorization request', async () => {
    const response = await request(app)
      .post('/oauth/request')
      .type('form')
      .send(oauth.authorizeQuery(oauth.CIMD_CLIENT, oauth.pkce().challenge));
    const { body } = await request(app).get(
      '/.well-known/oauth-authorization-server/oauth'
    );

    expect(response.status).toBe(404);
    expect(body.pushed_authorization_request_endpoint).toBeUndefined();
  });

  it.each([
    '/.well-known/oauth-authorization-server/oauth',
    '/oauth/.well-known/openid-configuration',
  ])(
    'announces only the scopes it grants, and no ID token, at %s',
    async (path) => {
      const { body } = await request(app).get(path);

      expect(body.scopes_supported).toEqual(['mcp:read', 'skills:write']);
      expect(body.id_token_signing_alg_values_supported).toBeUndefined();
    }
  );

  it('shows an error page of its own, with nothing from another site', async () => {
    const response = await request(app)
      .get('/oauth/auth')
      .query(
        oauth.authorizeQuery(oauth.CIMD_CLIENT, oauth.pkce().challenge, {
          redirect_uri: 'https://elsewhere.example.test/<b>callback</b>',
        })
      );

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toContain('invalid_redirect_uri');
    expect(response.text).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(response.text).not.toContain('<b>');
  });
});

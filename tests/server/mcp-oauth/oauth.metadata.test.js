/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// What a connected application discovers before it connects (ADR 0012): the
// MCP endpoint names its authorization server (RFC 9728), which describes
// itself (RFC 8414) with the three ways a client may register.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');

const { BASE, ISSUER, MCP_RESOURCE } = oauth;
const RESOURCE_METADATA = `${BASE}/.well-known/oauth-protected-resource/mcp`;

describe('metadata', () => {
  let app;
  beforeAll(() => {
    app = oauth.createApp();
  });

  it('answers a call without a token with where to find the authorization server', async () => {
    const response = await oauth.callMcp(app, null);

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toBe(
      `Bearer resource_metadata="${RESOURCE_METADATA}", scope="mcp:read"`
    );
  });

  it('lets no other site frame the authorization server', async () => {
    const response = await request(app).get(
      '/oauth/.well-known/openid-configuration'
    );

    expect(response.headers['content-security-policy']).toBe(
      "frame-ancestors 'none'"
    );
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('describes the MCP endpoint as a protected resource', async () => {
    const response = await request(app).get(
      '/.well-known/oauth-protected-resource/mcp'
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      resource: MCP_RESOURCE,
      authorization_servers: [ISSUER],
      scopes_supported: ['mcp:read'],
      bearer_methods_supported: ['header'],
    });
  });

  it('describes the authorization server', async () => {
    const response = await request(app).get(
      '/.well-known/oauth-authorization-server/oauth'
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/auth`,
      token_endpoint: `${ISSUER}/token`,
      registration_endpoint: `${ISSUER}/reg`,
      revocation_endpoint: `${ISSUER}/token/revocation`,
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: expect.arrayContaining(['mcp:read']),
      grant_types_supported: expect.arrayContaining([
        'authorization_code',
        'refresh_token',
      ]),
      token_endpoint_auth_methods_supported: expect.arrayContaining([
        'none',
        'client_secret_basic',
        'client_secret_post',
      ]),
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    });
  });

  it('offers neither the implicit flow nor the plain PKCE method', async () => {
    const { body } = await request(app).get(
      '/.well-known/oauth-authorization-server/oauth'
    );

    expect(body.response_types_supported).not.toContain('token');
    expect(body.code_challenge_methods_supported).not.toContain('plain');
  });
});

// The endpoints anyone may call are limited per address, against floods.
describe('flood protection', () => {
  it('stops registering clients from one address past 100 an hour', async () => {
    const app = oauth.createApp();
    const register = () =>
      request(app).post('/oauth/reg').send({ client_name: 'A flood' });
    for (let i = 0; i < 100; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await register();
    }

    const response = await register();

    expect(response.status).toBe(429);
  });
});

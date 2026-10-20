'use strict';

/**
 * Harness of the OAuth acceptance tests (epic #1290, ADR 0008): LePatron's
 * authorization server and its MCP endpoint, driven over HTTP the way a
 * connected application and its user's browser drive them.
 *
 * The flow the skipped suites of #1297 are written against:
 *
 * 1. `GET /oauth/auth` (client, PKCE challenge, `resource`, scope) answers a
 *    redirect to the consent page, `/oauth/consent/:uid`.
 * 2. The consent page reads `GET /api/oauth/interactions/:uid` with the user's
 *    session: the client's name, the scopes, and the groups the user may bind
 *    the connection to.
 * 3. It posts `POST /api/oauth/interactions/:uid/consent` with the group, or
 *    `/deny`, and is answered `{ redirectTo }`, where the browser resumes.
 * 4. The authorization server redirects to the client with a code and `iss`.
 * 5. `POST /oauth/token` trades the code and the PKCE verifier for tokens.
 *
 * `createApp`, `signIn`, `update` and `serveClientMetadata` are written by #1306, which
 * mounts the authorization server; the rest drives the flow above.
 */

const crypto = require('crypto');
const request = require('supertest');

const BASE = 'http://lepatron.test';
const MCP_RESOURCE = `${BASE}/mcp`;
const ISSUER = `${BASE}/oauth`;

// A client that registers with a Client ID Metadata Document, as Claude does.
const CIMD_CLIENT = Object.freeze({
  client_id: 'https://assistant.example.test/oauth/client.json',
  client_name: 'An assistant',
  redirect_uris: ['https://assistant.example.test/oauth/callback'],
  grant_types: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_method: 'none',
});

const NOT_YET = 'The OAuth harness is written by #1306';

/**
 * The app with the authorization server and the MCP endpoint mounted, the
 * records of `mcp-fixtures.js` seeded, and `CIMD_CLIENT`'s document served.
 */
function createApp() {
  throw new Error(NOT_YET);
}

/** A supertest agent carrying the session of `userId`, as after the login. */
function signIn() {
  throw new Error(NOT_YET);
}

/** Changes a seeded record, the way the app would (MCP access turned off). */
function update() {
  throw new Error(NOT_YET);
}

/** Answers `document` when the authorization server fetches `url`. */
function serveClientMetadata() {
  throw new Error(NOT_YET);
}

function pkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

function authorizeQuery(client, challenge, overrides = {}) {
  return {
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: client.redirect_uris[0],
    scope: 'mcp:read',
    resource: MCP_RESOURCE,
    state: 'state-1',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...overrides,
  };
}

// Steps 1 to 3: the uid of the consent waiting for the user.
async function startConsent(agent, client, challenge, overrides) {
  const started = await agent
    .get('/oauth/auth')
    .query(authorizeQuery(client, challenge, overrides));
  const [, uid] = /\/oauth\/consent\/([\w-]+)$/.exec(started.headers.location);
  return uid;
}

// Step 4: follow the resumed authorization to the client's redirect URI.
async function followToClient(agent, redirectTo) {
  const resumed = await agent.get(new URL(redirectTo, BASE).pathname);
  return new URL(resumed.headers.location);
}

/**
 * The whole flow for `userId`, bound to `group`: resolves with the tokens and
 * the verifier, or with the client's redirect URL when the flow stops there.
 */
async function connect(
  app,
  userId,
  { client = CIMD_CLIENT, group, secret } = {}
) {
  const agent = signIn(app, userId);
  const { verifier, challenge } = pkce();
  const uid = await startConsent(agent, client, challenge);
  const consent = await agent
    .post(`/api/oauth/interactions/${uid}/consent`)
    .send({ groupId: group });
  const back = await followToClient(agent, consent.body.redirectTo);
  const code = back.searchParams.get('code');
  if (!code) return { redirect: back };

  const token = request(app)
    .post('/oauth/token')
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: client.redirect_uris[0],
      code_verifier: verifier,
      resource: MCP_RESOURCE,
      client_id: client.client_id,
      ...(secret && { client_secret: secret }),
    });
  const { body } = await token;
  return { ...body, verifier };
}

// A JSON-RPC call to the MCP endpoint, as the connected application sends it.
function callMcp(app, accessToken, method = 'resources/list', params = {}) {
  const call = request(app)
    .post('/mcp')
    .set('Accept', 'application/json, text/event-stream')
    .send({ jsonrpc: '2.0', id: 1, method, params });
  return accessToken
    ? call.set('Authorization', `Bearer ${accessToken}`)
    : call;
}

module.exports = {
  BASE,
  MCP_RESOURCE,
  ISSUER,
  CIMD_CLIENT,
  createApp,
  signIn,
  update,
  serveClientMetadata,
  pkce,
  authorizeQuery,
  startConsent,
  followToClient,
  connect,
  callMcp,
};

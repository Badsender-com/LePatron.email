'use strict';

/**
 * Harness of the OAuth acceptance tests (epic #1290, ADR 0012): LePatron's
 * authorization server and its MCP endpoint, driven over HTTP the way a
 * connected application and its user's browser drive them.
 *
 * The flow the skipped suites of #1297 are written against:
 *
 * 1. `GET /oauth/auth` (client, PKCE challenge, `resource`, scope) answers a
 *    redirect to the consent page, `/oauth/consent/:uid`.
 * 2. The consent page reads `GET /oauth/consent/:uid/details` with the user's
 *    session and the provider's interaction cookie, which binds the consent
 *    to the browser that started: the client's name, where it redirects, the
 *    scopes, and the groups the user may bind the connection to.
 * 3. It posts `POST /oauth/consent/:uid/consent` with the group, or
 *    `/deny`, and is answered `{ redirectTo }`, where the browser resumes.
 * 4. The authorization server redirects to the client with a code and `iss`.
 * 5. `POST /oauth/token` trades the code and the PKCE verifier for tokens.
 *
 * `createApp` mounts the authorization server and the MCP endpoint on an
 * Express app, as index.js does, with the app's session reduced to the user
 * `signIn` names; the app's `provider` is the authorization server. It keeps
 * what it issues through the app's own adapter, in the fake database of
 * fake-mongo-collection.js, which `oauthStore()` answers. Requiring
 * this file replaces the models with the stand-ins of `mcp-fake-models.js` for
 * the whole test file, and quiets the logger. `signInBeforeCode` leaves the
 * session between the password and the verification code (ADR 0008).
 */

const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const request = require('./local-request');
const { createMcpStore } = require('./mcp-fake-models');
const { createFakeDb } = require('./fake-mongo-collection');
const f = require('./mcp-fixtures');

const store = createMcpStore();

jest.doMock(
  '../../packages/server/common/models.common.js',
  () => store.models
);
jest.doMock('../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// The server and all `createApp` mounts, the stand-ins in place, loaded with
// the test file rather than within its first test's five seconds: loading
// them takes a few hundred milliseconds alone, more with coverage, and
// several seconds on a loaded machine.
const { mountMcp } = require('../../packages/server/mcp/mcp-http.js');
const {
  McpOAuthAdapter,
} = require('../../packages/server/mcp/mcp-oauth-adapter.js');
const { oauthBodyParsers } = require('../../packages/server/mcp/mcp-oauth.js');
const mcpRateLimit = require('../../packages/server/mcp/mcp-rate-limit.js');
const permissions = require('../../packages/server/account/permissions.js');
const pendingStep = require('../../packages/server/two-factor/pending-step.js');
const {
  STEPS,
} = require('../../packages/server/two-factor/two-factor.constants.js');
const {
  connectedApplicationsRouter,
  groupConnectedApplicationsRouter,
} = require('../../packages/server/mcp/connected-application.routes.js');
const mcpClientRoutes = require('../../packages/server/mcp/mcp-client.routes.js');

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

// The documents the authorization server finds when it fetches a client_id.
let documents = new Map();

function fetchDocument(url) {
  const document = documents.get(String(url));
  return Promise.resolve(
    document
      ? new Response(JSON.stringify(document), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      : new Response('Not found', { status: 404 })
  );
}

const TEST_USER = 'x-test-user';
const PENDING_USER = 'x-test-pending-user';

/**
 * The app with the authorization server and the MCP endpoint mounted, the
 * records of `mcp-fixtures.js` seeded, and `CIMD_CLIENT`'s document served.
 */
function createApp() {
  store.seed(f.SEED);
  mongoose.connection.db = createFakeDb();
  documents = new Map([[CIMD_CLIENT.client_id, CIMD_CLIENT]]);
  mcpRateLimit.forgetCounts();

  const app = express();
  // As index.js reads the bodies: the authorization server's first.
  app.use('/oauth', ...oauthBodyParsers());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  // What passport leaves of the session (deserializeUser): the user with
  // its capabilities, an id alone for an account with no record (the
  // configuration's admin), or nobody.
  // Between the password and the verification code (ADR 0008): the session
  // holds the pending step, and no user.
  app.use((req, res, next) => {
    const userId = req.get(PENDING_USER);
    if (!userId) return next();
    req.session = {};
    pendingStep.start(req, { id: userId }, STEPS.VERIFY, 'totp');
    return next();
  });
  app.use((req, res, next) => {
    const userId = req.get(TEST_USER);
    if (!userId) return next();
    const record = store
      .stored('users')
      .find((user) => String(user._id) === userId && !user.isDeactivated);
    req.user = record
      ? permissions.withCapabilities({
          ...record,
          id: userId,
          group: { id: String(record._company) },
        })
      : { id: userId };
    return next();
  });
  // The authorization server, for what no HTTP client can do (a token issued
  // for another resource). The adapter as a factory: the provider, in Node's
  // realm, does not tell the test's class from a function.
  app.provider = mountMcp(app, {
    origin: BASE,
    cookieKeys: ['a-test-cookie-key'],
    adapter: (name) => new McpOAuthAdapter(name),
    fetch: fetchDocument,
    // Every host of the tests is a public one.
    lookup: async () => [{ address: '198.51.100.7', family: 4 }],
  });
  mountMcpRoutes(app);
  return app;
}

// The app's API routes of MCP, mounted as index.js mounts them, and its error
// handler's answer: the status, and the error code as the message.
function mountMcpRoutes(app) {
  app.use('/api/groups/:groupId/mcp-clients', mcpClientRoutes);
  app.use(
    '/api/groups/:groupId/connected-applications',
    groupConnectedApplicationsRouter
  );
  app.use('/api/connected-applications', connectedApplicationsRouter);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ ...err, status, message: err.message });
  });
}

/**
 * A supertest agent carrying the session of `userId`, as after the login, its
 * verification code checked when one is asked (ADR 0008).
 */
function signIn(app, userId) {
  return request.agent(app).set(TEST_USER, userId);
}

/**
 * A supertest agent of `userId` between the password and the verification
 * code (ADR 0008): the pending step is in its session, the account is not
 * signed in yet.
 */
function signInBeforeCode(app, userId) {
  return request.agent(app).set(PENDING_USER, userId);
}

/** What a collection of the models holds, as copies (`McpClients`…). */
function stored(collection) {
  return store.stored(collection);
}

// The clock of the authorization server, which runs in Node's own realm (see
// native-oidc-provider.js): spying on the test's `Date` does not move it.
const { NativeDate } = process
  .getBuiltinModule('module')
  .createRequire(__filename)('./native-realm.js');
const clocks = [];

/** Moves the authorization server's clock, and the test's, `ms` ahead. */
function later(ms) {
  [NativeDate, Date].forEach((clock) => {
    const now = clock.now();
    clocks.push(jest.spyOn(clock, 'now').mockReturnValue(now + ms));
  });
}

/** Gives both clocks back their time. */
function restoreClock() {
  clocks.splice(0).forEach((spy) => spy.mockRestore());
}

/** Changes a seeded record, the way the app would (MCP access turned off). */
function update(_app, collection, id, changes) {
  store.update(collection, id, changes);
}

/**
 * What the authorization server keeps, as stored: the fake collection of a
 * model of `oidc-provider` (`AccessToken`, `Grant`…).
 */
function oauthStore(model) {
  return mongoose.connection.db.collection(`mcp_oauth_${model.toLowerCase()}`);
}

/** Answers `document` when the authorization server fetches `url`. */
function serveClientMetadata(url, document) {
  documents.set(url, document);
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
  {
    client = CIMD_CLIENT,
    group,
    secret,
    scope,
    allowWrite,
    // The browser it consents in: a new one unless given.
    agent = signIn(app, userId),
  } = {}
) {
  const { verifier, challenge } = pkce();
  const uid = await startConsent(agent, client, challenge, scope && { scope });
  const consent = await agent
    .post(`/oauth/consent/${uid}/consent`)
    .send({ groupId: group, ...(allowWrite && { allowWrite }) });
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
  signInBeforeCode,
  update,
  stored,
  oauthStore,
  later,
  restoreClock,
  serveClientMetadata,
  pkce,
  authorizeQuery,
  startConsent,
  followToClient,
  connect,
  callMcp,
};

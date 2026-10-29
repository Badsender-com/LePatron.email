'use strict';

/**
 * Harness of the MCP acceptance tests (epic #1290, ADR 0012): the MCP server
 * driven by an in-memory MCP client, the way a connected application sees it.
 *
 * - `seed(records)` empties the stand-ins for the models and stores the
 *   records, as the schemas declare them (see `mcp-fixtures.js`).
 * - `connectAs(userId, options)` connects an MCP client to a fresh MCP server,
 *   with the identity a validated access token carries: the user, the group
 *   the token is bound to (the user's own group unless `group` says
 *   otherwise, as for a super admin), the consented `scopes` and the
 *   `clientId` of the connected application. Resolves with the SDK client.
 * - `update(collection, id, changes)` changes a stored record between two
 *   calls, the way the app would (a role changed, an account deactivated, MCP
 *   access turned off).
 * - `advanceClock(ms)` moves the server's clock forward, for what is counted
 *   per minute (the rate limit).
 * - `disconnect()` closes every client opened since the last `seed`.
 *
 * Requiring this file replaces the models with the stand-ins of
 * `mcp-fake-models.js` for the whole test file, and quiets the logger: require
 * it before anything that reads the models.
 */

const { createMcpStore } = require('./mcp-fake-models');

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

const { Client, InMemoryTransport } = require('@modelcontextprotocol/client');

let clients = [];

function seed(records) {
  store.seed(records);
}

function update(collection, id, changes) {
  store.update(collection, id, changes);
}

// The group a token is bound to: the one picked at consent, or else the
// user's own, as the consent screen offers a non super admin nothing else.
async function boundGroupOf(userId, options) {
  if ('group' in options) return options.group;
  const user = await store.models.Users.findById(userId).lean();
  return user ? String(user._company) : null;
}

async function connectAs(userId, options = {}) {
  const { scopes = ['mcp:read'], clientId = 'test-client' } = options;
  const authInfo = {
    token: `token-of-${userId}`,
    clientId,
    scopes,
    extra: { userId, groupId: await boundGroupOf(userId, options) },
  };

  // Required here: the server reads the models, which must be the stand-ins.
  const {
    createMcpServer,
  } = require('../../packages/server/mcp/mcp-server.js');
  // Built per connection, as the HTTP endpoint builds one per request once
  // the token is checked: what it offers depends on the token's scopes.
  const server = createMcpServer({ authInfo });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  // What the HTTP transport does once the bearer token is validated: every
  // message reaches the server with the token's identity.
  const send = clientSide.send.bind(clientSide);
  clientSide.send = (message, sendOptions) =>
    send(message, { ...sendOptions, authInfo });

  await server.connect(serverSide);
  const client = new Client({ name: 'mcp-acceptance-tests', version: '1.0.0' });
  await client.connect(clientSide);
  clients.push(client);
  return client;
}

function advanceClock() {
  throw new Error('The clock of the MCP harness is written by #1303');
}

async function disconnect() {
  const open = clients;
  clients = [];
  await Promise.all(open.map((client) => client.close()));
}

// What a tool answers, as the client receives it: the structured content, or
// the error a tool reports in its result.
function answerOf(result) {
  if (result.isError) {
    const text = result.content.map((part) => part.text).join('\n');
    return { error: text };
  }
  return result.structuredContent;
}

module.exports = {
  seed,
  connectAs,
  update,
  advanceClock,
  disconnect,
  answerOf,
};

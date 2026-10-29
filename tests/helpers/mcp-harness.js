'use strict';

/**
 * Harness of the MCP acceptance tests (epic #1290, ADR 0012): the MCP server
 * driven by an in-memory MCP client, the way a connected application sees it.
 *
 * The contract the skipped suites of #1297 are written against. #1299 writes
 * its body, with the MCP SDK it adds and stand-ins for the models built on the
 * fake Mongo query of the search epic (#1315): there is no test database.
 *
 * - `seed(records)` empties the stand-ins and stores the records, as the
 *   schemas declare them (see `mcp-fixtures.js`).
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
 */

const NOT_YET = 'The MCP harness is written by #1299';

function seed() {
  throw new Error(NOT_YET);
}

function connectAs() {
  throw new Error(NOT_YET);
}

function update() {
  throw new Error(NOT_YET);
}

function advanceClock() {
  throw new Error(NOT_YET);
}

async function disconnect() {}

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

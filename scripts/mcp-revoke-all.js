#!/usr/bin/env node
'use strict';

/**
 * Revokes every connected application of LePatron's MCP server at once
 * (ADR 0012), for every company: the way to cut every assistant off.
 *
 * What it does:
 * - unlists every connection (`McpConnections`), which `/mcp` refuses at the
 *   next call;
 * - deletes every grant, every access token, every refresh token and every
 *   authorization code of the authorization server, so no assistant
 *   refreshes;
 * - drops its logins and pending consents.
 *
 * The clients stay registered, by hand or by themselves, with their
 * secrets: an assistant connects again once its user consents again. To cut
 * one company only, turn its MCP access off instead, which revokes its
 * connections the same way. Changing `lepatron_mcpOauthJwks` cuts nothing:
 * the tokens are opaque, and checked against the store.
 *
 * Usage:
 *   node scripts/mcp-revoke-all.js --yes
 *
 * Without `--yes`, it says what it would do and changes nothing.
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const server = (...parts) =>
  path.resolve(__dirname, '..', 'packages', 'server', ...parts);

const CONFIRM = '--yes';

/**
 * @param {string[]} argv the command line
 * @returns {Promise<Object<string, number>|null>} how many went, by kind, or
 *   null when not confirmed
 */
async function main(argv = process.argv) {
  if (!argv.includes(CONFIRM)) {
    console.log(
      'Revokes every MCP connection, grant and token of every company.\n' +
        `Run again with ${CONFIRM} to do it.`
    );
    return null;
  }
  const config = require(server('node.config.js'));
  const { revokeAllConnections } = require(server('mcp', 'mcp-connections.js'));
  // The URI carries the credentials of the database: never printed.
  console.log('Connecting to the database…');
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    const counts = await revokeAllConnections();
    Object.entries(counts).forEach(([kind, count]) =>
      console.log(`${kind}: ${count} revoked`)
    );
    return counts;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  // Exits once done: something the models load keeps the event loop alive.
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main };

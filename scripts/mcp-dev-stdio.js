#!/usr/bin/env node
'use strict';

/**
 * Serve LePatron's MCP server over stdio, as one user of the local database,
 * to try it in an MCP client (Claude Code, Claude Desktop, MCP Inspector)
 * before the OAuth connection exists (#1306). Development only: the identity
 * is taken from the command line instead of a token, so it refuses to run in
 * production. Everything the server checks on a call still applies: the user
 * must be active and in the group, and the group must have MCP access.
 *
 * Usage:
 *   node scripts/mcp-dev-stdio.js --email someone@example.com [--group <groupId>]
 *
 * `--group` is the group a super admin works in; anyone else reads their own.
 * The database is the one of `.env` (DATABASE_URL), read from the current
 * directory. stdout carries the protocol: every log goes to stderr.
 */

const path = require('path');

// Before anything can log: stdout belongs to the MCP messages.
const protocolOut = process.stdout;
const toStderr = process.stderr.write.bind(process.stderr);
const stdoutProxy = Object.create(process.stdout, {
  write: { value: toStderr },
});
Object.defineProperty(process, 'stdout', { value: stdoutProxy });

require('dotenv').config();
const mongoose = require('mongoose');
const { StdioServerTransport } = require('@modelcontextprotocol/server/stdio');

const server = (...parts) =>
  path.resolve(__dirname, '..', 'packages', 'server', ...parts);
const config = require(server('node.config.js'));
const { Users } = require(server('common', 'models.common.js'));
const { createMcpServer } = require(server('mcp', 'mcp-server.js'));
const { READ_SCOPE } = require(server('mcp', 'mcp-identity.js'));

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  if (!config.isDev) {
    throw new Error('mcp-dev-stdio runs in development only.');
  }
  const email = argument('email');
  if (!email) {
    throw new Error(
      'Usage: node scripts/mcp-dev-stdio.js --email <email> [--group <groupId>]'
    );
  }

  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const user = await Users.findOne({ email: email.toLowerCase() }).lean();
  if (!user) throw new Error(`No user ${email} in ${config.database}`);

  // What a validated access token would carry.
  const authInfo = {
    token: 'local-development',
    clientId: 'mcp-dev-stdio',
    scopes: [READ_SCOPE],
    extra: {
      userId: String(user._id),
      groupId: argument('group') || String(user._company),
    },
  };

  const transport = new StdioServerTransport(process.stdin, protocolOut);
  await createMcpServer().connect(transport);
  const handle = transport.onmessage;
  transport.onmessage = (message, extra) =>
    handle(message, { ...extra, authInfo });

  process.stderr.write(
    `LePatron MCP (development) as ${email}, group ${authInfo.extra.groupId}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});

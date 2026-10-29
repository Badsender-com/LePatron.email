#!/usr/bin/env node
'use strict';

/**
 * Serve LePatron's MCP server over stdio, as one user of the local database,
 * to try it in an MCP client (Claude Code, Claude Desktop, MCP Inspector)
 * before the OAuth connection exists (#1306). Development only: the identity
 * is taken from the command line instead of a token, so anyone who runs it
 * reads as any account. It runs only when NODE_ENV=development is set
 * explicitly, and against a database that is not on this machine only when
 * `--allow-remote-database` says so on purpose. Everything the server checks
 * on a call still applies: the user must be active and in the company, and
 * the company must have MCP access.
 *
 * Usage:
 *   NODE_ENV=development node scripts/mcp-dev-stdio.js --email someone@example.com [--group <groupId>] [--write]
 *
 * `--group` is the company a super admin works in; anyone else reads their
 * own. `--write` adds the skills:write scope (ADR 0014): the drafting tools
 * are then offered, and still refused to whoever may not manage the platform.
 * The database is the one the configuration reads (node.config.js, through
 * `rc`): `lepatron_database`, from the environment, `.env` in the current
 * directory or a `.lepatronrc`, a local `lepatron` database by default. It is
 * never printed: its URI may carry credentials. stdout carries the protocol:
 * every log goes to stderr.
 */

const path = require('path');

const ALLOW_REMOTE_DATABASE = '--allow-remote-database';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

// The hosts of a MongoDB connection string, without credentials nor ports. A
// DNS seed list (`mongodb+srv://`) names no host of its own: none is local.
function hostsOf(uri) {
  const match = /^mongodb:\/\/(?:[^@/]*@)?([^/?]+)/.exec(String(uri || ''));
  if (!match) return [];
  return match[1]
    .split(',')
    .map((host) =>
      host.startsWith('[')
        ? host.slice(1, host.indexOf(']'))
        : host.split(':')[0]
    )
    .map((host) => host.toLowerCase());
}

/**
 * @param {string} uri a MongoDB connection string
 * @returns {boolean} whether every host it names is this machine
 */
function isLocalDatabase(uri) {
  const hosts = hostsOf(uri);
  return hosts.length > 0 && hosts.every((host) => LOCAL_HOSTS.has(host));
}

/**
 * @param {{ isDev: boolean, database: string }} config
 * @param {string[]} argv the command line
 * @param {Object} [env] the environment, `process.env` by default
 * @throws {Error} when the bridge must not run, without naming the database
 */
function assertMayRun(config, argv, env = process.env) {
  if (env.NODE_ENV !== 'development' || !config.isDev) {
    throw new Error(
      'mcp-dev-stdio runs in development only: set NODE_ENV=development.'
    );
  }
  if (
    !isLocalDatabase(config.database) &&
    !argv.includes(ALLOW_REMOTE_DATABASE)
  ) {
    throw new Error(
      `mcp-dev-stdio reads as any account: it runs against a local database only, or with ${ALLOW_REMOTE_DATABASE}.`
    );
  }
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

// Before anything can log: stdout belongs to the MCP messages.
function keepStdoutForTheProtocol() {
  const protocolOut = process.stdout;
  const toStderr = process.stderr.write.bind(process.stderr);
  const stdoutProxy = Object.create(process.stdout, {
    write: { value: toStderr },
  });
  Object.defineProperty(process, 'stdout', { value: stdoutProxy });
  return protocolOut;
}

async function main(protocolOut) {
  require('dotenv').config();
  const server = (...parts) =>
    path.resolve(__dirname, '..', 'packages', 'server', ...parts);
  const config = require(server('node.config.js'));
  assertMayRun(config, process.argv);

  const email = argument('email');
  if (!email) {
    throw new Error(
      'Usage: NODE_ENV=development node scripts/mcp-dev-stdio.js --email <email> [--group <groupId>] [--write]'
    );
  }

  const mongoose = require('mongoose');
  const {
    StdioServerTransport,
  } = require('@modelcontextprotocol/server/stdio');
  const { Users } = require(server('common', 'models.common.js'));
  const { createMcpServer } = require(server('mcp', 'mcp-server.js'));
  const { READ_SCOPE } = require(server('mcp', 'mcp-identity.js'));
  const { WRITE_SCOPE } = require(server('mcp', 'mcp-authoring.js'));

  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const user = await Users.findOne({ email: email.toLowerCase() }).lean();
  if (!user) throw new Error(`No user ${email} in this database`);

  // What a validated access token would carry.
  const authInfo = {
    token: 'local-development',
    clientId: 'mcp-dev-stdio',
    scopes: process.argv.includes('--write')
      ? [READ_SCOPE, WRITE_SCOPE]
      : [READ_SCOPE],
    extra: {
      userId: String(user._id),
      groupId: argument('group') || String(user._company),
    },
  };

  const transport = new StdioServerTransport(process.stdin, protocolOut);
  await createMcpServer({ authInfo }).connect(transport);
  const handle = transport.onmessage;
  transport.onmessage = (message, extra) =>
    handle(message, { ...extra, authInfo });

  process.stderr.write(
    `LePatron MCP (development) as ${email}, company ${authInfo.extra.groupId}\n`
  );
}

if (require.main === module) {
  main(keepStdoutForTheProtocol()).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

module.exports = { isLocalDatabase, assertMayRun };

'use strict';

// What a script may print about the database it connects to: the hosts and the
// database name of the connection string, never its credentials. The URI
// carries the database password, and this output ends up in terminals and job
// logs (AGENTS.md, Conventions › packages/server: never log a password). The
// name is not a secret, and it is what tells a copy from production when both
// live on the same hosts.
//
// Parsed by hand because `new URL` rejects a replica set's host list. A
// password with an unencoded `/`, `?` or `@` (or a socket path) would shift the
// parts: anything that is not plainly hosts and a name gives the fallback.

const FALLBACK = 'mongo';
const HOST = String.raw`(?:[A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?`;
const HOSTS = new RegExp(`^${HOST}(?:,${HOST})*$`);
// MongoDB forbids these in a database name.
const DATABASE_NAME = /^[^\s/\\."$*<>:|?@]+$/;

function databaseHost(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/([^/?]*)(.*)$/.exec(
    typeof uri === 'string' ? uri : ''
  );
  if (!match) return FALLBACK;
  const [, authority, rest] = match;
  // An `@` past the hosts: the credentials hold an unencoded `/` or `?`.
  if (rest.includes('@')) return FALLBACK;
  const userinfoEnd = authority.indexOf('@');
  if (userinfoEnd !== authority.lastIndexOf('@')) return FALLBACK;
  const hosts = authority.slice(userinfoEnd + 1);
  if (!HOSTS.test(hosts)) return FALLBACK;
  const [path] = rest.split('?');
  const database = path.replace(/^\//, '');
  if (database === '') return hosts;
  if (!DATABASE_NAME.test(database)) return FALLBACK;
  return `${hosts}/${database}`;
}

module.exports = { databaseHost };

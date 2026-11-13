'use strict';

// Host (and port) of a Mongo connection string, without user:password or query
// parameters: the connection string carries the credentials and must never
// reach the logs (AGENTS.md § Logging). The host alone is enough to tell
// environments apart. Falls back to a placeholder rather than risk echoing the
// URI.
function databaseHost(uri) {
  try {
    return new URL(uri).host || 'mongo';
  } catch (e) {
    return 'mongo';
  }
}

module.exports = { databaseHost };

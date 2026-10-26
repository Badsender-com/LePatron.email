'use strict';

// Defaults of node.config.js made for a developer's machine. The repository
// is public: anywhere but in development and the tests, the server refuses
// to start on them rather than run with values anyone can read.
const DEFAULTS = {
  sessionSecret: '3MYdqy0lZZz2TXCr7YlxT9N6',
  'admin.password': 'admin',
};

const ENV_NAMES = {
  sessionSecret: 'lepatron_sessionSecret',
  'admin.password': 'lepatron_admin__password',
};

// Named explicitly: an unset NODE_ENV reads as development in node.config.js,
// and must not skip the check (`yarn dev` sets it, packages/server/nodemon.json).
const DEFAULTS_ALLOWED_IN = ['development', 'test'];

const valueAt = (config, dotted) =>
  dotted
    .split('.')
    .reduce((node, key) => (node ? node[key] : undefined), config);

/**
 * @param {Object} config the application's (node.config.js)
 * @param {string|undefined} nodeEnv `process.env.NODE_ENV`, as the process
 *   received it
 * @throws {Error} naming the settings left to their default
 */
function assertNoDevDefaults(config, nodeEnv) {
  if (DEFAULTS_ALLOWED_IN.includes(nodeEnv)) return;
  const left = Object.keys(DEFAULTS).filter(
    (key) => !valueAt(config, key) || valueAt(config, key) === DEFAULTS[key]
  );
  if (left.length > 0) {
    throw new Error(
      `Set ${left.map((key) => ENV_NAMES[key]).join(', ')}, or NODE_ENV=` +
        'development on a developer machine: the default is public, the ' +
        'server does not start on it.'
    );
  }
}

module.exports = { assertNoDevDefaults, DEFAULTS };

'use strict';

// Defaults of node.config.js made for a developer's machine. The repository
// is public: outside development, the server refuses to start on them rather
// than run with values anyone can read.
const DEFAULTS = {
  sessionSecret: '3MYdqy0lZZz2TXCr7YlxT9N6',
  'admin.password': 'admin',
};

const ENV_NAMES = {
  sessionSecret: 'lepatron_sessionSecret',
  'admin.password': 'lepatron_admin__password',
};

const valueAt = (config, dotted) =>
  dotted
    .split('.')
    .reduce((node, key) => (node ? node[key] : undefined), config);

/**
 * @param {Object} config the application's (node.config.js)
 * @throws {Error} naming the settings left to their default, outside
 *   development and tests
 */
function assertProductionSecrets(config) {
  if (config.isDev || config.NODE_ENV === 'test') return;
  const left = Object.keys(DEFAULTS).filter(
    (key) => !valueAt(config, key) || valueAt(config, key) === DEFAULTS[key]
  );
  if (left.length > 0) {
    throw new Error(
      `Set ${left
        .map((key) => ENV_NAMES[key])
        .join(', ')}: the default is public, the server does not start on it.`
    );
  }
}

module.exports = { assertProductionSecrets, DEFAULTS };

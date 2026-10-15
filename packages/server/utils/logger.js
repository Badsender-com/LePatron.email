const morgan = require('morgan');
const chalk = require('chalk');
const consola = require('consola');

const config = require('../node.config.js');

// use this to handle ≠ consola logger
// https://www.npmjs.com/package/consola#fields
// https://github.com/nuxt/consola/blob/HEAD/src/types.js
consola.level = config.CONSOLA_LEVEL;

const logger = consola.create({
  reporters: [new consola[config.isDev ? 'FancyReporter' : 'JSONReporter']()],
});

/// ///
// LOGGING
/// ///

// A share link's token is its only credential (share-link.service.js): a log
// holding it would hand out working links. Only its first characters remain,
// enough to tell two links apart. Express routes the path however it is
// written (/SHARE/, //share/, a token percent-encoded): everything after
// /share/ goes, up to the query string.
const SHARE_TOKEN_IN_URL = /^(\/+share\/+)([^?#]{0,4})[^?#]*/i;

function loggedUrl(tokens, req, res) {
  return (tokens.url(req, res) || '').replace(SHARE_TOKEN_IN_URL, '$1$2…');
}

function logRequest(tokens, req, res) {
  const method = chalk.blue(tokens.method(req, res));
  const url = chalk.grey(loggedUrl(tokens, req, res));
  return `${chalk.grey('==>')} ${method} ${url}`;
}

const colorCodes = {
  7: 'magenta',
  5: 'red',
  4: 'yellow',
  3: 'cyan',
  2: 'green',
  1: 'green',
  0: 'yellow',
};

function logResponse(tokens, req, res) {
  const method = chalk.blue(tokens.method(req, res));
  const url = chalk.grey(loggedUrl(tokens, req, res));
  const status = tokens.status(req, res);
  const responseTime = `${tokens['response-time'](req, res)}ms`;
  /* eslint no-bitwise: "off" */
  const s = (status / 100) | 0;
  const statusColor = Object.prototype.hasOwnProperty.call(colorCodes, s)
    ? colorCodes[s]
    : 'grey';
  return `${chalk.grey('<==')} ${method} ${url} ${chalk[statusColor](
    status
  )} ${chalk.grey(responseTime)}`;
}

const ASSETS_REGEX = /_nuxt|__webpack_hmr|_loading|node_modules/;
const skipLog = (req) => ASSETS_REGEX.test(req.originalUrl);

logger.logRequest = () =>
  morgan(logRequest, { immediate: true, skip: skipLog });
logger.logResponse = () => morgan(logResponse, { skip: skipLog });
// exported for testing
logger.loggedUrl = loggedUrl;

module.exports = logger;

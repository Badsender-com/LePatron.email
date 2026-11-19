'use strict';

const compression = require('compression');

// Which responses the app gzips.
// • Events routes are left out, SSE answers being cut by the compression
//   https://github.com/expressjs/compression#chunksize
// • The MCP endpoint streams its answers as server-sent events too.
const EVENT_ROUTE_REGEX = /\/events$/;
const MCP_ROUTE_REGEX = /^\/mcp$/;

/**
 * The `filter` of the `compression` middleware, which replaces its own:
 * past the streamed routes, it asks the default, which leaves out what is
 * already compressed (images, archives) or of an unknown type.
 *
 * @param {Object} req
 * @param {Object} res
 * @returns {boolean}
 */
function shouldCompress(req, res) {
  if (EVENT_ROUTE_REGEX.test(req.path) || MCP_ROUTE_REGEX.test(req.path)) {
    return false;
  }
  return compression.filter(req, res);
}

module.exports = { shouldCompress };

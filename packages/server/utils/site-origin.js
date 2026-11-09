'use strict';

const config = require('../node.config.js');

// The site's public origin, which the links of the emails and the MCP
// authorization server's issuer are built on. Its scheme is the one the site
// is served with: https everywhere but in development, as the FORCE HTTPS
// middleware of index.js decides (`forcessl` arrives as a string from the
// environment, "false" included, so it cannot tell).
function siteOrigin() {
  return `http${config.isDev ? '' : 's'}://${config.host}`;
}

module.exports = { siteOrigin };

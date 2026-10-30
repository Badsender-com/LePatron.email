'use strict';

const http = require('http');
const https = require('https');

// Since Node 19 the global agents keep sockets alive, idle ones for 5 s. An
// outbound call without its own agent then reuses a socket the peer may close
// at that very moment, and fails with ECONNRESET or "socket hang up". That is
// the ESP connectors going through axios, node-fetch or request, and the image
// fetch, none of which retry. Node 18 opened a socket per request; this keeps
// it. A call that wants keep-alive passes its own agent.
//
// Plain agents: Node 24's global ones also follow NODE_USE_ENV_PROXY, which
// the app does not use (its proxy is config.proxyUrl, with its own agent).
function disableOutboundKeepAlive() {
  http.globalAgent = new http.Agent({ keepAlive: false });
  https.globalAgent = new https.Agent({ keepAlive: false });
}

module.exports = { disableOutboundKeepAlive };

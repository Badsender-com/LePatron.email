'use strict';

const http = require('http');
const https = require('https');

// Since Node 19 the global agents keep sockets alive, idle ones for 5 s. An
// outbound call without its own agent then reuses a socket the peer may close
// at that very moment, and fails with ECONNRESET or "socket hang up". That is
// every ESP connector (axios, node-fetch, request, superagent through the
// Brevo SDK) and the image fetch, none of which retry. Node 18 opened a socket
// per request; this keeps it. A call that wants keep-alive passes its own
// agent, as integration-providers/provider-http.js does.
function disableOutboundKeepAlive() {
  http.globalAgent = new http.Agent({ keepAlive: false });
  https.globalAgent = new https.Agent({ keepAlive: false });
}

module.exports = { disableOutboundKeepAlive };

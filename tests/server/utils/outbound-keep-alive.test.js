'use strict';

// Since Node 19 the global HTTP agents keep sockets alive. A peer that drops
// an idle socket just as the next request reuses it answers ECONNRESET, so
// outbound calls without their own agent keep Node 18's one socket per request.

const http = require('http');
const https = require('https');

const {
  disableOutboundKeepAlive,
} = require('../../../packages/server/utils/outbound-keep-alive.js');

const originalAgents = { http: http.globalAgent, https: https.globalAgent };

function get(port) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: '/' }, (res) => {
        res.resume();
        res.on('end', resolve);
      })
      .on('error', reject);
  });
}

describe('outbound calls without their own agent', () => {
  let server;
  let connections;

  beforeEach(async () => {
    connections = 0;
    server = http.createServer((req, res) => res.end('ok'));
    server.on('connection', () => {
      connections += 1;
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  afterAll(() => {
    http.globalAgent = originalAgents.http;
    https.globalAgent = originalAgents.https;
  });

  it('open a socket per request, as on Node 18', async () => {
    disableOutboundKeepAlive();
    const { port } = server.address();

    await get(port);
    await get(port);
    await get(port);

    expect(connections).toBe(3);
  });

  it('do so for HTTPS too', () => {
    disableOutboundKeepAlive();

    expect(http.globalAgent.keepAlive).toBe(false);
    expect(https.globalAgent.keepAlive).toBe(false);
    expect(https.globalAgent).toBeInstanceOf(https.Agent);
  });
});

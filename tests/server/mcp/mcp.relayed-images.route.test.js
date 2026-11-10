/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The public route of the relayed images (ADR 0022), as a client of the
// internet meets it.

const mockGuardedFetch = jest.fn();
jest.mock(
  '../../../packages/server/integration-providers/provider-http.js',
  () => ({
    ...jest.requireActual(
      '../../../packages/server/integration-providers/provider-http.js'
    ),
    guardedFetch: (...args) => mockGuardedFetch(...args),
  })
);

const express = require('express');
const request = require('../../helpers/local-request');

const LOGO = 'https://cdn.example.test/brand/logo.png';

describe('the route of the relayed images', () => {
  let app;
  let relayedPathOf;
  let perMinute;

  beforeEach(() => {
    mockGuardedFetch.mockReset();
    let address;
    let router;
    jest.isolateModules(() => {
      address = require('../../../packages/server/mcp/mcp-relayed-image-address.js');
      router = require('../../../packages/server/mcp/mcp-relayed-images.routes.js');
    });
    perMinute = router.RELAYED_IMAGES_PER_MINUTE;
    app = express();
    app.use('/api/relayed-images', router);
    relayedPathOf = (url) => {
      const relayed = new URL(address.relayedUrlOf(url));
      return relayed.pathname + relayed.search;
    };
  });

  it('limits the requests of one address, widely', async () => {
    const server = app.listen(0, '127.0.0.1');
    const unsigned = '/api/relayed-images/0.forged?url=x';
    for (let i = 0; i < perMinute; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(server).get(unsigned);
      expect(res.status).toBe(404);
    }

    const past = await request(server).get(relayedPathOf(LOGO));
    server.close();

    expect(perMinute).toBeGreaterThanOrEqual(300);
    expect(past.status).toBe(429);
    expect(mockGuardedFetch).not.toHaveBeenCalled();
  });
});

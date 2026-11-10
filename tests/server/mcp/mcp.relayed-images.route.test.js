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
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

const answers = (bytes, status = 200) =>
  mockGuardedFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    buffer: async () => bytes,
  });

describe('the route of the relayed images', () => {
  let app;
  let relayedPathOf;
  let perMinute;
  let logger;

  beforeEach(() => {
    mockGuardedFetch.mockReset();
    let address;
    let router;
    jest.isolateModules(() => {
      address = require('../../../packages/server/mcp/mcp-relayed-image-address.js');
      router = require('../../../packages/server/mcp/mcp-relayed-images.routes.js');
      logger = require('../../../packages/server/utils/logger.js');
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

  it.each([
    ['an image', 200, () => answers(PNG)],
    ['no image', 404, () => answers(PNG, 404)],
  ])(
    'answers %s that runs nothing and loads nothing',
    async (_c, status, arrange) => {
      arrange();

      const res = await request(app).get(relayedPathOf(LOGO));

      expect(res.status).toBe(status);
      expect(res.headers['content-security-policy']).toBe(
        "default-src 'none'; sandbox"
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    }
  );

  it('lets no image be kept a minute only', async () => {
    const res = await request(app).get('/api/relayed-images/0.forged?url=x');

    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('public, max-age=60');
  });

  it('never fetches for a HEAD, and answers what it holds', async () => {
    answers(PNG);

    const before = await request(app).head(relayedPathOf(LOGO));
    expect(before.status).toBe(404);
    expect(mockGuardedFetch).not.toHaveBeenCalled();

    await request(app).get(relayedPathOf(LOGO));
    const after = await request(app).head(relayedPathOf(LOGO));
    expect(after.status).toBe(200);
    expect(after.headers['content-type']).toBe('image/png');
    expect(mockGuardedFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the host refuses it', () => answers(PNG, 403), /answered 403/],
    ['it is no image', () => answers(Buffer.from('<html>')), /not a PNG/],
    [
      'the guard refuses it',
      () =>
        mockGuardedFetch.mockRejectedValue(
          new Error('relayed image: timed out')
        ),
      /timed out/,
    ],
  ])('logs the host and the reason when %s', async (_c, arrange, reason) => {
    arrange();
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await request(app).get(relayedPathOf(`${LOGO}?token=secret`));

    expect(warn).toHaveBeenCalledTimes(1);
    const [line] = warn.mock.calls[0];
    expect(line).toMatch(/cdn\.example\.test/);
    expect(line).toMatch(reason);
    expect(line).not.toMatch(/secret|logo\.png/);
  });
});

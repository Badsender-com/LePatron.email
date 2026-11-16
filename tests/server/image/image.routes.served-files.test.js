'use strict';

// The files of the storage as a browser receives them from /api/images: a
// raster image is shown inline, where emails and the editor load it; an SVG or
// anything that is not an image is a download, in a sandbox, so it never runs
// as a page of the application. No answer lets the browser guess another type.

jest.mock('sharp', () => jest.fn());
jest.mock('puppeteer', () => ({}));
jest.mock('probe-image-size', () => {
  const probe = jest.fn();
  probe.sync = jest.fn();
  return probe;
});
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  streamImage: jest.fn(),
  writeStreamFromStream: jest.fn().mockResolvedValue(undefined),
  streamImageFromPreviews: jest.fn(),
}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  CacheImages: { findOne: jest.fn() },
  Galleries: { findOne: jest.fn() },
  Mailings: { findOne: jest.fn() },
  Templates: { findOne: jest.fn() },
  Users: {},
}));

const { PassThrough } = require('stream');
const express = require('express');
const request = require('../../helpers/local-request.js');

const probe = require('probe-image-size');
const fileManager = require('../../../packages/server/common/file-manage.service.js');

let router;
beforeAll(() => {
  router = require('../../../packages/server/image/image.routes.js');
});

function app() {
  const server = express();
  server.use('/api/images', router);
  server.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return server;
}

function stored(bytes) {
  fileManager.streamImage.mockImplementation(() => {
    const readable = new PassThrough();
    readable.end(Buffer.from(bytes));
    return readable;
  });
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>';

beforeEach(() => {
  jest.clearAllMocks();
  probe.mockRejectedValue(new Error('unrecognized format'));
});

describe('a file served from the storage', () => {
  it('shows a raster image inline, its type never guessed', async () => {
    stored('\x89PNG\r\n\x1a\n');

    const res = await request(app()).get('/api/images/a-b.png');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('serves an SVG as a sandboxed download', async () => {
    stored(SVG);

    const res = await request(app()).get('/api/images/a-b.svg');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/svg\+xml/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toBe('attachment');
    expect(res.headers['content-security-policy']).toMatch(/sandbox/);
    expect(res.headers['content-security-policy']).toMatch(
      /default-src 'none'/
    );
  });

  it('serves an SVG stored under another extension as a sandboxed download', async () => {
    stored(SVG);
    probe.mockResolvedValue({ mime: 'image/svg+xml', type: 'svg' });

    const res = await request(app()).get('/api/images/a-b.bin');

    expect(res.headers['content-type']).toMatch(/^image\/svg\+xml/);
    expect(res.headers['content-disposition']).toBe('attachment');
    expect(res.headers['content-security-policy']).toMatch(/sandbox/);
  });

  it.each([
    ['a-b.html', /^text\/html/],
    ['a-b.bin', /^application\/octet-stream/],
    ['a-b.unknownext', /^application\/octet-stream/],
  ])('serves %s, not an image, as a sandboxed download', async (name, type) => {
    stored('<html><script>1</script></html>');

    const res = await request(app()).get(`/api/images/${name}`);

    expect(res.headers['content-type']).toMatch(type);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toBe('attachment');
    expect(res.headers['content-security-policy']).toMatch(/sandbox/);
  });

  it('never lets the browser guess the type of an error either', async () => {
    fileManager.streamImage.mockImplementation(() => {
      const readable = new PassThrough();
      process.nextTick(() =>
        readable.emit(
          'error',
          Object.assign(new Error('x'), { code: 'ENOENT' })
        )
      );
      return readable;
    });

    const res = await request(app()).get('/api/images/missing.png');

    expect(res.status).toBe(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

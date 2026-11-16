'use strict';

// Which responses the app gzips: what compression itself would, the
// server-sent events of the events routes and of the MCP endpoint aside.

const {
  shouldCompress,
} = require('../../../packages/server/utils/compression-filter.js');

const request = (path) => ({ path, headers: {} });
const response = (type) => ({
  getHeader: (name) =>
    name.toLowerCase() === 'content-type' ? type : undefined,
});

describe('the responses the app compresses', () => {
  it.each([
    ['/editor', 'text/html; charset=utf-8'],
    ['/api/mailings', 'application/json; charset=utf-8'],
    ['/editor.js', 'application/javascript'],
  ])('compresses %s, of a compressible type', (path, type) => {
    expect(shouldCompress(request(path), response(type))).toBe(true);
  });

  it.each([
    ['/api/images/logo.png', 'image/png'],
    ['/api/images/photo.jpg', 'image/jpeg'],
    ['/api/mailings/1/zip', 'application/zip'],
    ['/api/download', undefined],
  ])(
    'leaves %s alone, its type already compressed or unknown',
    (path, type) => {
      expect(shouldCompress(request(path), response(type))).toBe(false);
    }
  );

  it.each([
    ['/api/mailings/1/events', 'text/event-stream'],
    ['/api/mailings/1/events', 'text/html'],
    ['/mcp', 'text/event-stream'],
    ['/mcp', 'application/json'],
  ])('never compresses the server-sent events of %s (%s)', (path, type) => {
    expect(shouldCompress(request(path), response(type))).toBe(false);
  });
});

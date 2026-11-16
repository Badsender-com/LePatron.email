'use strict';

// The application's pages and API answers are framed by the application only
// (the editor and the previews frame its own pages). The images that emails
// and other sites embed stay free to load anywhere.

const express = require('express');
const request = require('../../helpers/local-request.js');

const {
  sameOriginFraming,
} = require('../../../packages/server/utils/frame-headers.js');

function app() {
  const server = express();
  server.use(sameOriginFraming);
  server.get('*', (_req, res) => res.send('ok'));
  return server;
}

describe('sameOriginFraming', () => {
  it.each([
    '/',
    '/account/login',
    '/editor/507f1f77bcf86cd799439011',
    '/api/mailings',
  ])('%s is framed by the application only', async (path) => {
    const res = await request(app()).get(path);

    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toBe(
      "frame-ancestors 'self'"
    );
  });

  it.each([
    '/api/images/507f1f77bcf86cd799439011-abc.png',
    '/api/images/resize/100x100/507f1f77bcf86cd799439011-abc.png',
    '/api/images/placeholder/100x100.png',
  ])('%s can be embedded anywhere', async (path) => {
    const res = await request(app()).get(path);

    expect(res.headers['x-frame-options']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('does not take a lookalike path for the images', async () => {
    const res = await request(app()).get('/api/images-other');

    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

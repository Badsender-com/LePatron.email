'use strict';

// The images an export reads are URLs of the email's HTML, which its authors
// write: the server must not be made to read a private address with them.
// Our own gallery's images are read directly; any other address, each
// redirect included, must be a public one. Real HTTP, against a server on the
// loopback, which only our own host may reach.

const http = require('http');
const config = require('../../../packages/server/node.config.js');
const {
  readImageSource,
} = require('../../../packages/server/utils/image-source.js');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('reading an image of an email', () => {
  let server;
  let port;
  let requests;
  let ownHost;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requests.push(req.url);
      if (req.url.endsWith('/redirect-to-loopback')) {
        res.writeHead(302, { Location: `http://127.0.0.1:${port}/secret` });
        return res.end();
      }
      if (req.url.endsWith('/large.png')) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        return res.end(Buffer.alloc(2048));
      }
      if (req.url.endsWith('/missing.png')) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
    ownHost = config.host;
  });

  afterAll(async () => {
    config.host = ownHost;
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    requests = [];
    config.host = 'lepatron.example.com';
  });

  it('reads the images of our own gallery, with their type', async () => {
    config.host = `127.0.0.1:${port}`;

    const { content, contentType } = await readImageSource(
      `http://127.0.0.1:${port}/api/images/hero.png`
    );

    expect(content.equals(PNG)).toBe(true);
    expect(contentType).toBe('image/png');
  });

  it('gives the rest of our own host no exemption', async () => {
    config.host = `127.0.0.1:${port}`;

    await expect(
      readImageSource(`http://127.0.0.1:${port}/admin/secret`)
    ).rejects.toThrow();
    expect(requests).toEqual([]);
  });

  it.each([
    [
      'a private address written as an IP',
      () => `http://127.0.0.1:${port}/x.png`,
    ],
    [
      'the cloud metadata address',
      () => 'http://169.254.169.254/latest/meta-data/',
    ],
    ['an IPv6 loopback', () => `http://[::1]:${port}/x.png`],
    ['a decimal IPv4', () => `http://2130706433:${port}/x.png`],
    [
      'a name that resolves to a private address',
      () => `http://localhost:${port}/x.png`,
    ],
    ['another protocol', () => 'file:///etc/passwd'],
  ])('refuses %s', async (_label, url) => {
    await expect(readImageSource(url())).rejects.toThrow();
    expect(requests).toEqual([]);
  });

  it('refuses a redirect to a private address, checking each hop', async () => {
    config.host = `127.0.0.1:${port}`;

    await expect(
      readImageSource(
        `http://127.0.0.1:${port}/api/images/redirect-to-loopback`
      )
    ).rejects.toThrow();
    expect(requests).toEqual(['/api/images/redirect-to-loopback']);
  });

  it('refuses an image over the size given', async () => {
    config.host = `127.0.0.1:${port}`;

    await expect(
      readImageSource(`http://127.0.0.1:${port}/api/images/large.png`, {
        maxBytes: 1024,
      })
    ).rejects.toThrow();
  });

  it('fails on an image that is not there', async () => {
    config.host = `127.0.0.1:${port}`;

    await expect(
      readImageSource(`http://127.0.0.1:${port}/api/images/missing.png`)
    ).rejects.toThrow('404');
  });
});

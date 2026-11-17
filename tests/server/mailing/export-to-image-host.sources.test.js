'use strict';

// The sources of the images an export puts on an image host are URLs of the
// email's HTML, which its authors write: the server must not be made to read
// a private address with them. Our own images are read directly; any other
// address, a redirect included, must be a public one. Real HTTP, against a
// server on the loopback, which only our own host may reach.

const http = require('http');
const config = require('../../../packages/server/node.config.js');
const {
  readSource,
} = require('../../../packages/server/mailing/export-to-image-host.js');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('reading the source of an image', () => {
  let server;
  let port;
  let requests;
  let ownHost;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requests.push(req.url);
      if (req.url === '/redirect-to-loopback') {
        res.writeHead(302, { Location: `http://127.0.0.1:${port}/hero.png` });
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

  it('reads our own images directly', async () => {
    config.host = `127.0.0.1:${port}`;

    const content = await readSource(`http://127.0.0.1:${port}/hero.png`);

    expect(content.equals(PNG)).toBe(true);
  });

  it('refuses a private address written as an IP', async () => {
    await expect(
      readSource(`http://127.0.0.1:${port}/hero.png`)
    ).rejects.toThrow();
    expect(requests).toEqual([]);
  });

  it('refuses the cloud metadata address', async () => {
    await expect(
      readSource('http://169.254.169.254/latest/meta-data/')
    ).rejects.toThrow();
  });

  it('refuses a name that resolves to a private address', async () => {
    await expect(
      readSource(`http://localhost:${port}/hero.png`)
    ).rejects.toThrow();
    expect(requests).toEqual([]);
  });

  // Our host may redirect; where it sends to is checked like any address.
  it('refuses a redirect to a private address', async () => {
    config.host = `127.0.0.1:${port}`;

    await expect(
      readSource(`http://127.0.0.1:${port}/redirect-to-loopback`)
    ).resolves.toBeDefined();

    config.host = `localhost:${port}`;
    requests = [];
    await expect(
      readSource(`http://localhost:${port}/redirect-to-loopback`)
    ).rejects.toThrow();
    expect(requests).toEqual(['/redirect-to-loopback']);
  });
});

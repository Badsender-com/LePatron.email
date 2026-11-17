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
      if (req.url.endsWith('/redirect-to-loopback')) {
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

  it('reads the images of our own gallery directly', async () => {
    config.host = `127.0.0.1:${port}`;

    const content = await readSource(
      `http://127.0.0.1:${port}/api/images/hero.png`
    );

    expect(content.equals(PNG)).toBe(true);
  });

  it('gives the rest of our own host no exemption', async () => {
    config.host = `127.0.0.1:${port}`;

    await expect(
      readSource(`http://127.0.0.1:${port}/admin/secret`)
    ).rejects.toThrow();
    expect(requests).toEqual([]);
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
      readSource(`http://127.0.0.1:${port}/api/images/redirect-to-loopback`)
    ).rejects.toThrow();

    config.host = `localhost:${port}`;
    requests = [];
    await expect(
      readSource(`http://localhost:${port}/api/images/redirect-to-loopback`)
    ).rejects.toThrow();
    expect(requests).toEqual(['/api/images/redirect-to-loopback']);
  });
});

describe("the email's folder on the image host", () => {
  const {
    emailFolderName,
  } = require('../../../packages/server/mailing/export-to-image-host.js');

  it('is the email name and a short identifier', () => {
    expect(
      emailFolderName({ _id: '507f1f77bcf86cd799439055', name: 'Soldes été' })
    ).toBe('soldes-ete-439055');
  });

  it('stays readable when the name has nothing the slug keeps', () => {
    expect(
      emailFolderName({ _id: '507f1f77bcf86cd799439055', name: '???' })
    ).toBe('email-439055');
  });
});

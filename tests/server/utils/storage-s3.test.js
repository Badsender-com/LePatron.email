/**
 * @jest-environment node
 */
'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');

// Real S3 acknowledges a PUT only once the object is stored, some time after
// the last byte of the body left the socket. This fake S3 makes that gap
// explicit, so we can tell "bytes sent" apart from "object stored".
const ACK_DELAY_MS = 300;

let server;
let storage;
let dir;
const stored = new Map();

function fakeS3(req, res) {
  const key = decodeURIComponent(req.url.split('?')[0].split('/').pop());
  if (req.method === 'PUT' && key.startsWith('denied')) {
    req.resume();
    req.on('end', () => {
      res.writeHead(403, { 'Content-Type': 'application/xml' });
      res.end('<Error><Code>AccessDenied</Code><Message>no</Message></Error>');
    });
    return;
  }
  if (req.method === 'PUT') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () =>
      setTimeout(() => {
        stored.set(key, Buffer.concat(chunks));
        res.writeHead(200, { ETag: '"etag"' });
        res.end();
      }, ACK_DELAY_MS)
    );
    return;
  }
  if (req.method === 'GET' && stored.has(key)) {
    res.writeHead(200);
    res.end(stored.get(key));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/xml' });
  res.end('<Error><Code>NoSuchKey</Code><Message>no</Message></Error>');
}

function readObject(name) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = storage.streamImage(name);
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

beforeAll(async () => {
  server = http.createServer(fakeS3);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  jest.doMock('../../../packages/server/node.config.js', () => ({
    isAws: true,
    isDev: false,
    storage: {
      aws: {
        endpoint: `http://127.0.0.1:${port}`,
        bucketName: 'bucket',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        region: 'us-east-1',
        s3ForcePathStyle: true,
      },
    },
  }));
  storage = require('../../../packages/server/utils/storage-s3.js');

  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lepatron-s3-'));
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => stored.clear());

describe('storage-s3', () => {
  // The editor asks for the thumbnail as soon as the upload answers: if the
  // object isn't there yet, the gallery tile stays blank and the image dropped
  // in the email collapses, until the creation is reopened.
  it('writeStreamFromPath resolves only once the object can be read', async () => {
    const filePath = path.join(dir, 'upload');
    fs.writeFileSync(filePath, Buffer.alloc(32 * 1024, 7));

    await storage.writeStreamFromPath({ name: 'uploaded.png', path: filePath });

    await expect(readObject('uploaded.png')).resolves.toHaveLength(32 * 1024);
  });

  it('writeStreamFromStream resolves only once the object can be read', async () => {
    const source = new PassThrough();
    source.end(Buffer.alloc(16 * 1024, 3));

    await storage.writeStreamFromStream(source, 'resized.png');

    await expect(readObject('resized.png')).resolves.toHaveLength(16 * 1024);
  });

  it('writeStreamFromStreamWithPrefix resolves only once the object can be read', async () => {
    const source = new PassThrough();
    source.end(Buffer.alloc(8 * 1024, 5));

    await storage.writeStreamFromStreamWithPrefix(source, 'prefixed.png', 'p');

    await expect(readObject('prefixed.png')).resolves.toHaveLength(8 * 1024);
  });

  // a refused write must surface as an error, not as a silent success that
  // hands the editor the URL of an image that will never exist
  it('rejects when S3 refuses the object', async () => {
    const source = new PassThrough();
    source.end(Buffer.alloc(1024, 1));

    await expect(
      storage.writeStreamFromStream(source, 'denied.png')
    ).rejects.toMatchObject({ code: 'AccessDenied' });
  });
});

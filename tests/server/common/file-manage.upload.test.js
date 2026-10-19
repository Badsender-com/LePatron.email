'use strict';

// parseMultipart, fed a real multipart request: what the editor's upload gets
// back, and that a file which cannot be stored ends its request with an error
// rather than leaving it unanswered.

jest.mock('../../../packages/server/utils/storage-local', () => ({
  writeStreamFromPath: jest.fn(),
}));
jest.mock('fs-extra', () => ({
  ...jest.requireActual('fs-extra'),
  readFile: jest.fn(),
}));

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const fsExtra = require('fs-extra');

const config = require('../../../packages/server/node.config.js');
const storage = require('../../../packages/server/utils/storage-local');
const fileManager = require('../../../packages/server/common/file-manage.service.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const PREFIX = '507f1f77bcf86cd799439011';
// 8x8 PNG, as in upload-identity.names.test.js
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVR42mP4z8DwHx9mGBkKAMLXf4HVAzL9AAAAAElFTkSuQmCC',
  'base64'
);

let tmpDir;
beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lepatron-upload-'));
  config.images.tmpDir = tmpDir;
});
afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

beforeEach(() => {
  jest.clearAllMocks();
  storage.writeStreamFromPath.mockResolvedValue(undefined);
});

function uploadApp(formatter) {
  const server = express();
  server.post('/upload', (req, res, next) => {
    fileManager
      .parseMultipart(req, { prefix: PREFIX, formatter })
      .then((result) => res.json(result))
      .catch(next);
  });
  server.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return server;
}

const upload = (bytes, filename, contentType) =>
  request(uploadApp('editor'))
    .post('/upload')
    .attach('files[]', bytes, { filename, contentType });

describe('parseMultipart — an editor upload', () => {
  it('stores an image under its content name and describes it', async () => {
    const res = await upload(PNG, 'Mon Image.png', 'image/png');

    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0]).toMatchObject({
      name: expect.stringMatching(new RegExp(`^${PREFIX}-[0-9a-f]{32}\\.png$`)),
      uploadedName: 'Mon Image.png',
      originalName: 'mon-image.png',
      width: 8,
      height: 8,
    });
    expect(storage.writeStreamFromPath).toHaveBeenCalledTimes(1);
  });

  // Neither the declared type nor the bytes give an extension to store it
  // under.
  it('refuses a file it cannot name, with an error code', async () => {
    const res = await upload(
      Buffer.from('not an image at all'),
      'notes',
      'application/x-unknown-type'
    );

    expect(res.status).toBe(422);
    expect(res.body.message).toBe(ERROR_CODES.UPLOAD_NOT_STORED);
    expect(storage.writeStreamFromPath).not.toHaveBeenCalled();
  });

  it('refuses a request that carries no file', async () => {
    const res = await request(uploadApp('editor'))
      .post('/upload')
      .field('name', 'value');

    expect(res.status).toBe(422);
    expect(res.body.message).toBe(ERROR_CODES.UPLOAD_NOT_STORED);
  });

  // formidable calls the `file` handler synchronously, outside any promise:
  // a throw there used to leave the request unanswered.
  it('answers with an error when storing the file throws', async () => {
    storage.writeStreamFromPath.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const res = await upload(PNG, 'image.png', 'image/png');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('storage unavailable');
  });

  it('answers with an error when the storage rejects', async () => {
    storage.writeStreamFromPath.mockRejectedValue(new Error('write failed'));

    const res = await upload(PNG, 'image.png', 'image/png');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('write failed');
  });
});

describe('parseMultipart — a template upload', () => {
  it('answers with an error when the markup cannot be read', async () => {
    fsExtra.readFile.mockRejectedValue(new Error('unreadable'));

    const res = await request(uploadApp('templates'))
      .post('/upload')
      .attach('markup', Buffer.from('<html></html>'), 'template.html');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('unreadable');
  });

  it('keeps the markup when it can be read', async () => {
    fsExtra.readFile.mockResolvedValue('<html></html>');

    const res = await request(uploadApp('templates'))
      .post('/upload')
      .attach('markup', Buffer.from('<html></html>'), 'template.html');

    expect(res.status).toBe(200);
    expect(res.body.markup).toBe('<html></html>');
  });
});

describe('parseMultipart — what it reads of an upload', () => {
  const SNIFF_BYTES = 4096;
  const JPEG_SNIFF_BYTES = 128 * 1024;

  // A JPEG whose SOF0, and so its dimensions, sits after a large APP1.
  function jpegWithLargeApp1(width, height) {
    const appSize = 65533;
    return Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1, appSize >> 8, appSize & 0xff]),
      Buffer.alloc(appSize - 2),
      Buffer.from([0xff, 0xc0, 0, 0x11, 8, height >> 8, height & 0xff]),
      Buffer.from([width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3]),
      Buffer.from([0x11, 1]),
      Buffer.alloc(64 * 1024),
    ]);
  }

  // [position, length] of each read of the upload's bytes
  let reads;
  beforeEach(() => {
    reads = [];
    const readSync = fsExtra.readSync;
    jest
      .spyOn(fsExtra, 'readSync')
      .mockImplementation((fd, buffer, offset, length, position) => {
        reads.push([position, length]);
        return readSync(fd, buffer, offset, length, position);
      });
  });
  afterEach(() => fsExtra.readSync.mockRestore());

  it.each([
    ['the type it declares', 'image/png'],
    ['a generic type', 'application/octet-stream'],
  ])('reads the head of a PNG once, with %s', async (_case, type) => {
    const res = await upload(PNG, 'image.png', type);

    expect(res.body.files[0]).toMatchObject({ width: 8, height: 8 });
    expect(reads).toEqual([[0, SNIFF_BYTES]]);
  });

  it('reads on past the head only for a JPEG, and never a byte twice', async () => {
    const res = await upload(
      jpegWithLargeApp1(800, 600),
      'photo.jpg',
      'image/jpeg'
    );

    expect(res.body.files[0]).toMatchObject({ width: 800, height: 600 });
    expect(reads).toEqual([
      [0, SNIFF_BYTES],
      [SNIFF_BYTES, JPEG_SNIFF_BYTES - SNIFF_BYTES],
    ]);
  });
});

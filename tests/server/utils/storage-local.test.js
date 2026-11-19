'use strict';

// The local storage reads a file of the upload folder by its name, and only
// one of that folder: any other name answers as a missing file.

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('../../helpers/local-request.js');

const config = require('../../../packages/server/node.config.js');
const storage = require('../../../packages/server/utils/storage-local.js');

let root;
let previousUploadDir;

beforeAll(async () => {
  // the config settles its own folders first; the test's comes after
  await config.setup;
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'lepatron-storage-'));
  fs.mkdirSync(path.join(root, 'uploads'));
  fs.writeFileSync(path.join(root, 'uploads', 'a-b.png'), 'stored');
  fs.writeFileSync(path.join(root, 'outside.txt'), 'not stored');
  previousUploadDir = config.images.uploadDir;
  config.images.uploadDir = path.join(root, 'uploads');
});

afterAll(() => {
  config.images.uploadDir = previousUploadDir;
  fs.rmSync(root, { recursive: true, force: true });
});

const read = (name) =>
  new Promise((resolve) => {
    const chunks = [];
    storage
      .streamImage(name)
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', () => resolve({ text: Buffer.concat(chunks).toString() }))
      .on('error', (error) => resolve({ error }));
  });

describe('storage-local streamImage', () => {
  it('reads a file of the upload folder', async () => {
    expect(await read('a-b.png')).toEqual({ text: 'stored' });
  });

  it.each([
    '../outside.txt',
    '..\\outside.txt',
    'sub/../../outside.txt',
    '..',
    'a-b.png\0',
  ])('answers %j as a missing file', async (name) => {
    const { error, text } = await read(name);

    expect(text).toBeUndefined();
    expect(error.code).toBe('ENOENT');
  });

  // Express decodes %2F in a route parameter: the name reaches the storage
  // with its slashes.
  it('answers a name with an encoded slash as a missing file', async () => {
    const app = express();
    app.get('/:imageName', (req, res) => {
      storage
        .streamImage(req.params.imageName)
        .on('error', (error) =>
          res.sendStatus(error.code === 'ENOENT' ? 404 : 500)
        )
        .pipe(res);
    });

    const res = await request(app).get('/..%2Foutside.txt');

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('not stored');
  });
});

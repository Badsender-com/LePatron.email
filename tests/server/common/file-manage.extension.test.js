'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  resolveUploadExtension,
} = require('../../../packages/server/common/file-manage.service.js');

// 8x8 fixtures inlined as bytes: sharp's native module does not load under
// Jest's module system, and only the file headers matter here anyway
const PNG_FIXTURE =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVR42mP4z8DwHx9mGBkKAMLXf4HVAzL9AAAAAElFTkSuQmCC';
const JPEG_FIXTURE =
  '/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKQB8Wf/2Q==';

let dir;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lepatron-upload-'));
  fs.writeFileSync(
    path.join(dir, 'png-bytes'),
    Buffer.from(PNG_FIXTURE, 'base64')
  );
  fs.writeFileSync(
    path.join(dir, 'jpeg-bytes'),
    Buffer.from(JPEG_FIXTURE, 'base64')
  );
  fs.writeFileSync(
    path.join(dir, 'not-an-image'),
    'just some text, not a pixel'
  );
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const upload = (name, type) => ({ path: path.join(dir, name), type });

describe('resolveUploadExtension', () => {
  it('trusts a declared type it can map', () => {
    expect(resolveUploadExtension(upload('png-bytes', 'image/png'))).toBe(
      'png'
    );
    expect(resolveUploadExtension(upload('jpeg-bytes', 'image/jpeg'))).toBe(
      'jpeg'
    );
  });

  it('sniffs the bytes when the declared type is empty', () => {
    // the `.false` case: mime.extension('') answers `false`, and the previous
    // code interpolated it straight into the stored filename
    expect(resolveUploadExtension(upload('png-bytes', ''))).toBe('png');
    expect(resolveUploadExtension(upload('jpeg-bytes', undefined))).toBe(
      'jpeg'
    );
  });

  it('never returns the string "false"', () => {
    for (const type of ['', undefined, null, 'nonsense/nope']) {
      expect(resolveUploadExtension(upload('png-bytes', type))).not.toBe(
        'false'
      );
    }
  });

  it('sniffs PNG bytes announced as octet-stream', () => {
    // the `.bin` case: mime.extension('application/octet-stream') is 'bin'
    expect(
      resolveUploadExtension(upload('png-bytes', 'application/octet-stream'))
    ).toBe('png');
  });

  it('gives up when the bytes are not an image', () => {
    expect(resolveUploadExtension(upload('not-an-image', ''))).toBeNull();
  });

  it('does not throw when the file is unreadable', () => {
    expect(resolveUploadExtension(upload('missing-file', ''))).toBeNull();
  });
});

describe('resolveUploadExtension — non-image uploads', () => {
  it('keeps the declared mapping when the bytes are not an image', () => {
    // a legitimate non-image asset must keep working as before
    expect(
      resolveUploadExtension(upload('not-an-image', 'application/octet-stream'))
    ).toBe('bin');
  });
});

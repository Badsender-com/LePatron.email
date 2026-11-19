'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  resolveUploadExtension,
  storedExtension,
} = require('../../../packages/server/common/upload-identity.service.js');

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
  fs.writeFileSync(
    path.join(dir, 'svg-bytes'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"></svg>'
  );
  // a JPEG whose dimensions sit past the sniffed head: its first bytes still
  // say what it is
  fs.writeFileSync(
    path.join(dir, 'jpeg-large-exif'),
    Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xfe]),
      Buffer.alloc(8192),
    ])
  );
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const upload = (name, type) => ({ path: path.join(dir, name), type });

describe('resolveUploadExtension', () => {
  it('names the format of an image as declared', () => {
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

describe('resolveUploadExtension — the bytes decide', () => {
  it.each([
    ['text/html', 'png-bytes', 'png'],
    ['image/jpeg', 'png-bytes', 'png'],
    ['application/xml', 'jpeg-bytes', 'jpeg'],
    ['image/png', 'svg-bytes', 'svg'],
    ['text/html', 'jpeg-large-exif', 'jpeg'],
  ])(
    'stores what is declared %s as the format of its bytes (%s)',
    (type, file, ext) => {
      expect(resolveUploadExtension(upload(file, type))).toBe(ext);
    }
  );
});

describe('storedExtension', () => {
  it('names an image after its bytes, whatever the declared type', () => {
    expect(
      storedExtension(Buffer.from(PNG_FIXTURE, 'base64'), 'text/html')
    ).toBe('png');
  });

  it('keeps the declared mapping when the bytes are not an image', () => {
    expect(storedExtension(Buffer.from('plain text'), 'application/pdf')).toBe(
      'pdf'
    );
    expect(storedExtension(Buffer.from('plain text'), '')).toBeNull();
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

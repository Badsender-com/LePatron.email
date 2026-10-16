'use strict';

// The two names an accepted upload is stored under.
//
// This exists because of one defect: a name with no extension used to throw
// inside formidable's `file` event handler, where the process-wide
// `uncaughtException` net swallowed it. Nothing was written, nothing was
// answered, and the client waited forever — no error, no file, no clue.

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  resolveUploadNames,
} = require('../../../packages/server/common/upload-identity.service.js');

// 8x8 fixtures inlined as bytes, like file-manage.extension.test.js: sharp's
// native module does not load under Jest, and only the headers matter here
const PNG_FIXTURE =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVR42mP4z8DwHx9mGBkKAMLXf4HVAzL9AAAAAElFTkSuQmCC';

const PREFIX = '507f1f77bcf86cd799439011';
const HASH = 'a1b2c3d4';

let dir;
let pngPath;
let textPath;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lepatron-names-'));
  pngPath = path.join(dir, 'png-bytes');
  textPath = path.join(dir, 'text-bytes');
  fs.writeFileSync(pngPath, Buffer.from(PNG_FIXTURE, 'base64'));
  fs.writeFileSync(textPath, 'not an image at all');
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const png = (name, type = 'image/png') => ({
  name,
  type,
  path: pngPath,
  hash: HASH,
  size: 100,
});

describe('resolveUploadNames — the ordinary case', () => {
  it('addresses the stored file by its content, not by its name', () => {
    expect(resolveUploadNames(png('photo.png'), PREFIX).name).toBe(
      `${PREFIX}-${HASH}.png`
    );
  });

  it('slugs the original name, keeping its extension', () => {
    expect(resolveUploadNames(png('Mon Image.png'), PREFIX).originalName).toBe(
      'mon-image.png'
    );
  });

  it('follows the bytes when the declared type contradicts them', () => {
    // the browser's "I have no idea" type, which used to store PNGs as `.bin`
    const file = png('photo.bin', 'application/octet-stream');
    expect(resolveUploadNames(file, PREFIX).name).toBe(`${PREFIX}-${HASH}.png`);
  });
});

describe('resolveUploadNames — a name with no extension', () => {
  // The defect this function was extracted for. `slugFilename` answers
  // `false` here, and `false.replace(…)` was the next line.
  it('does not throw', () => {
    expect(() => resolveUploadNames(png('clepsidre'), PREFIX)).not.toThrow();
  });

  it('lends it the extension the bytes just revealed', () => {
    const names = resolveUploadNames(png('clepsidre'), PREFIX);
    expect(names).not.toBeNull();
    expect(names.name).toBe(`${PREFIX}-${HASH}.png`);
    expect(names.originalName).toBe('clepsidre.png');
  });

  // The shape the image editor produces when the label it copies has none.
  it('handles the copy of an extensionless label', () => {
    const names = resolveUploadNames(png('clepsidre (2)'), PREFIX);
    expect(names.originalName).toBe('clepsidre-2.png');
  });
});

describe('resolveUploadNames — what it refuses', () => {
  it('refuses an upload that is not an image', () => {
    const file = { name: 'notes.txt', type: '', path: textPath, hash: HASH };
    expect(resolveUploadNames(file, PREFIX)).toBeNull();
  });

  // Refusing is the point: the caller stores nothing, and the response
  // formatter then refuses to describe a file that was never written. The old
  // path answered with a formatted name regardless, which put a thumbnail in
  // the gallery in front of nothing at all.
  //
  // Real image bytes, so the format check passes and the whitespace name is
  // actually reached — an earlier version of this test pointed at a text file,
  // so `resolveUploadNames` returned null at the format check and the name
  // handling it claims to guard was never exercised.
  it('answers null for a name that is only whitespace', () => {
    expect(resolveUploadNames(png('   '), PREFIX)).toBeNull();
  });

  it('refuses a name that slugs away to nothing', () => {
    // speakingurl keeps nothing of this, so there is no base left to key the
    // template assets map with
    expect(resolveUploadNames(png('...png'), PREFIX)).toBeNull();
  });
});

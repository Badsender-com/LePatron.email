'use strict';

const {
  needsDimensions,
  buildBackfilledFiles,
} = require('../../../packages/server/scripts/backfill-gallery-dimensions.js');

const sized = (name, width, height) => ({ name, label: name, width, height });
const unsized = (name) => ({ name, label: name });

describe('needsDimensions', () => {
  it('wants to read a file that has none', () => {
    expect(needsDimensions(unsized('a.png'))).toBe(true);
  });

  it('leaves a file that already has both', () => {
    expect(needsDimensions(sized('a.png', 800, 600))).toBe(false);
  });

  // A half-filled entry is as useless to the tooltip as an empty one, and can
  // only come from an interrupted or buggy run.
  it('wants to read a file that has only one of the two', () => {
    expect(needsDimensions({ name: 'a.png', width: 800 })).toBe(true);
    expect(needsDimensions({ name: 'a.png', height: 600 })).toBe(true);
  });

  // 0 is not a dimension an image can have, and it would make the tooltip
  // claim "0 × 0".
  it('treats a zero as missing', () => {
    expect(needsDimensions(sized('a.png', 0, 600))).toBe(true);
  });
});

describe('buildBackfilledFiles', () => {
  it('fills what it was able to read', () => {
    const files = [unsized('a.png'), unsized('b.png')];
    const sizes = new Map([
      ['a.png', { width: 800, height: 600 }],
      ['b.png', { width: 32, height: 32 }],
    ]);

    const result = buildBackfilledFiles(files, sizes);

    expect(result.filled).toBe(2);
    expect(result.updatedFiles[0]).toMatchObject({ width: 800, height: 600 });
    expect(result.updatedFiles[1]).toMatchObject({ width: 32, height: 32 });
  });

  // Idempotent: the script is resumable, so a second run must be a no-op.
  it('leaves an already-known file untouched, object included', () => {
    const known = sized('a.png', 800, 600);
    const result = buildBackfilledFiles([known], new Map());

    expect(result.skipped).toBe(1);
    expect(result.filled).toBe(0);
    expect(result.updatedFiles[0]).toBe(known);
  });

  // A gallery can list a file that is no longer in storage. That must not stop
  // the run, and must not write a half-entry.
  it('counts a file it could not read, and changes nothing about it', () => {
    const missing = unsized('gone.png');
    const result = buildBackfilledFiles([missing], new Map());

    expect(result.unreadable).toBe(1);
    expect(result.filled).toBe(0);
    expect(result.updatedFiles[0]).toBe(missing);
    expect(result.updatedFiles[0]).not.toHaveProperty('width');
  });

  it('keeps every other field of the file it fills', () => {
    const files = [
      {
        name: 'a.png',
        label: 'mon image.png',
        source: 'upload',
        externalMetadata: { from: 'somewhere' },
        uploadedAt: new Date('2026-01-01'),
      },
    ];
    const sizes = new Map([['a.png', { width: 10, height: 20 }]]);

    const [file] = buildBackfilledFiles(files, sizes).updatedFiles;

    expect(file.label).toBe('mon image.png');
    expect(file.source).toBe('upload');
    expect(file.externalMetadata).toEqual({ from: 'somewhere' });
    expect(file.uploadedAt).toEqual(new Date('2026-01-01'));
  });

  it('handles a mixed gallery and reports each case', () => {
    const files = [
      sized('known.png', 1, 1),
      unsized('readable.png'),
      unsized('gone.png'),
    ];
    const sizes = new Map([['readable.png', { width: 5, height: 5 }]]);

    const result = buildBackfilledFiles(files, sizes);

    expect(result).toMatchObject({ filled: 1, skipped: 1, unreadable: 1 });
    expect(result.updatedFiles).toHaveLength(3);
  });

  it('does not mutate the array it was given', () => {
    const files = [unsized('a.png')];
    const copy = [...files];
    buildBackfilledFiles(files, new Map([['a.png', { width: 1, height: 2 }]]));
    expect(files).toEqual(copy);
    expect(files[0]).not.toHaveProperty('width');
  });
});

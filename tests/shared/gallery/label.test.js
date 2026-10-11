'use strict';

const {
  sanitizeLabel,
  labelForUpload,
  nextCopyLabel,
  MAX_LABEL_LENGTH,
} = require('../../../packages/shared/gallery/label.js');

describe('sanitizeLabel', () => {
  it('keeps an ordinary name untouched', () => {
    expect(sanitizeLabel('Mon Image.jpg')).toBe('Mon Image.jpg');
  });

  it('keeps accents and case', () => {
    expect(sanitizeLabel('Séparateur Été.png')).toBe('Séparateur Été.png');
  });

  it('trims and collapses whitespace', () => {
    expect(sanitizeLabel('  mon    image.jpg  ')).toBe('mon image.jpg');
  });

  it('returns an empty string for a non-string', () => {
    [undefined, null, 42, {}, ['a']].forEach((value) => {
      expect(sanitizeLabel(value)).toBe('');
    });
  });

  it('returns an empty string when only whitespace is left', () => {
    expect(sanitizeLabel('   ')).toBe('');
  });

  // The rename endpoint has always refused a label over the cap. An upload
  // wrote the same field with no bound at all, so a very long file name became
  // a label its own rename endpoint would then reject.
  it('caps the length at the same limit the rename endpoint enforces', () => {
    const long = 'a'.repeat(MAX_LABEL_LENGTH + 500);
    expect(sanitizeLabel(long)).toHaveLength(MAX_LABEL_LENGTH);
  });

  it('strips control characters', () => {
    expect(sanitizeLabel('photo\u0000\u001B\u007F.jpg')).toBe('photo.jpg');
  });

  it('turns a newline into a single space rather than keeping two lines', () => {
    expect(sanitizeLabel('ligne1\nligne2.jpg')).toBe('ligne1 ligne2.jpg');
  });

  // U+202E reverses the text that follows it, so the stored name can render
  // with its extension backwards.
  it('strips bidirectional overrides', () => {
    expect(sanitizeLabel('photo\u202Egnp.exe')).toBe('photognp.exe');
    expect(sanitizeLabel('a\u200E\u200F\u2066b.png')).toBe('ab.png');
  });
});

describe('labelForUpload', () => {
  const STORED = '6a2135b7f802c2a6f99a4242-abc123.png';

  it('uses the name the user gave, not the stored one', () => {
    expect(labelForUpload(STORED, 'Mon Image.png')).toBe('Mon Image.png');
  });

  it('falls back to the stored name when nothing usable was sent', () => {
    expect(labelForUpload(STORED, undefined)).toBe(STORED);
    expect(labelForUpload(STORED, '   ')).toBe(STORED);
    expect(labelForUpload(STORED, null)).toBe(STORED);
  });

  it('sanitises the name it was given', () => {
    expect(labelForUpload(STORED, '  Mon   Image.png ')).toBe('Mon Image.png');
  });

  // resolveUploadExtension exists because the client's declared name lies. The
  // label says what the image is, so it follows the extension actually stored.
  it('replaces an extension that contradicts the stored one', () => {
    expect(labelForUpload(STORED, 'photo.bin')).toBe('photo.png');
  });

  it('accepts a matching extension whatever its case', () => {
    expect(labelForUpload(STORED, 'Photo.PNG')).toBe('Photo.PNG');
  });

  it('appends the stored extension when the name has none', () => {
    expect(labelForUpload(STORED, 'photo sans extension')).toBe(
      'photo sans extension.png'
    );
  });

  it('keeps the name as-is when the stored name has no extension', () => {
    expect(labelForUpload('no-extension-at-all', 'photo.bin')).toBe(
      'photo.bin'
    );
  });

  it('stays within the cap after swapping the extension', () => {
    const long = `${'a'.repeat(MAX_LABEL_LENGTH)}.bin`;
    expect(labelForUpload(STORED, long).length).toBeLessThanOrEqual(
      MAX_LABEL_LENGTH
    );
  });
});

// US-10 — editing never replaces the original, so every edit adds an entry.
// Two entries under one label would be indistinguishable in the grid.
describe('nextCopyLabel', () => {
  it('numbers the first copy (2), not (1)', () => {
    expect(nextCopyLabel('photo.jpg', ['photo.jpg'])).toBe('photo (2).jpg');
  });

  it('takes the next free number when earlier copies exist', () => {
    const gallery = ['photo.jpg', 'photo (2).jpg', 'photo (3).jpg'];
    expect(nextCopyLabel('photo.jpg', gallery)).toBe('photo (4).jpg');
  });

  it('fills a gap rather than always counting from the end', () => {
    const gallery = ['photo.jpg', 'photo (3).jpg'];
    expect(nextCopyLabel('photo.jpg', gallery)).toBe('photo (2).jpg');
  });

  // Editing a copy continues the series instead of nesting inside it:
  // "photo (2) (2).jpg" is nobody's idea of a file name.
  it('continues the series when the source is itself a copy', () => {
    const gallery = ['photo.jpg', 'photo (2).jpg'];
    expect(nextCopyLabel('photo (2).jpg', gallery)).toBe('photo (3).jpg');
  });

  it('keeps the extension behind the number', () => {
    expect(nextCopyLabel('mon image.png', [])).toBe('mon image (2).png');
  });

  it('numbers a name that has no extension at all', () => {
    expect(nextCopyLabel('taratata', ['taratata'])).toBe('taratata (2)');
  });

  // Two labels differing only in case are indistinguishable at a glance,
  // which is the whole thing this avoids.
  it('treats a difference of case as a collision', () => {
    expect(nextCopyLabel('Photo.jpg', ['photo (2).JPG'])).toBe('Photo (3).jpg');
  });

  it('works on an empty gallery', () => {
    expect(nextCopyLabel('photo.jpg', [])).toBe('photo (2).jpg');
    expect(nextCopyLabel('photo.jpg')).toBe('photo (2).jpg');
  });

  it('sanitises what it is handed, like every other label path', () => {
    expect(nextCopyLabel('  mon   image.png  ', [])).toBe('mon image (2).png');
    expect(nextCopyLabel(null, [])).toBe('');
    expect(nextCopyLabel(42, [])).toBe('');
  });

  // The base gives way, not the number: the number is what makes the name
  // unique, and the extension is what says what the file is.
  it('stays within the cap by trimming the base, not the number', () => {
    const long = `${'a'.repeat(MAX_LABEL_LENGTH - 4)}.png`;
    expect(long).toHaveLength(MAX_LABEL_LENGTH);

    const copy = nextCopyLabel(long, []);

    expect(copy.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH);
    expect(copy.endsWith(' (2).png')).toBe(true);
  });

  it('never cuts an emoji in half when it trims', () => {
    // long enough that the cut lands exactly inside the surrogate pair
    const long = `${'a'.repeat(246)}\u{1F600}.png`;
    const copy = nextCopyLabel(long, []);

    expect(copy.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH);
    expect(copy.endsWith(' (2).png')).toBe(true);
    const base = copy.slice(0, -' (2).png'.length);
    expect(/[\uD800-\uDBFF]$/.test(base)).toBe(false);
    // the emoji went entirely, rather than half of it staying
    expect(base).toBe('a'.repeat(246));
  });
});

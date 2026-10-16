'use strict';

const {
  filterGalleryFiles,
} = require('../../../packages/shared/gallery/filter.js');

const MONGO_ID = '6a212f21f802c2a6f99a4184';

const TEST_FILES = [
  {
    name: `${MONGO_ID}-aaa.jpg`,
    label: 'logo.jpg',
    uploadedAt: new Date('2026-01-01'),
  },
  {
    name: `${MONGO_ID}-bbb.jpeg`,
    label: 'banniere.jpeg',
    uploadedAt: new Date('2026-02-01'),
  },
  {
    name: `${MONGO_ID}-ccc.png`,
    label: 'icone.png',
    uploadedAt: null,
  },
  {
    name: `${MONGO_ID}-ddd.gif`,
    label: 'Animation.gif',
    uploadedAt: new Date('2026-03-01'),
  },
];

describe('filterGalleryFiles', () => {
  describe('with no criteria', () => {
    it('returns every file', () => {
      const result = filterGalleryFiles(TEST_FILES, {});
      expect(result).toHaveLength(TEST_FILES.length);
    });

    it('returns an empty array for an empty gallery', () => {
      const result = filterGalleryFiles([], { search: 'test' });
      expect(result).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('matches the label regardless of case', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        search: 'LOGO',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('logo.jpg');
    });

    it('matches on a partial label', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        search: 'ani',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Animation.gif');
    });

    it('returns an empty array when nothing matches', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        search: 'inexistant',
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('format', () => {
    it('filters jpg in lowercase', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'jpg',
      });
      expect(result).toHaveLength(2); // .jpg + .jpeg
    });

    it('filters jpg in uppercase', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'JPG',
      });
      expect(result).toHaveLength(2);
    });

    it('treats jpeg as jpg', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'jpg',
      });
      const names = result.map((f) => f.name);
      expect(names).toContain(`${MONGO_ID}-aaa.jpg`);
      expect(names).toContain(`${MONGO_ID}-bbb.jpeg`);
    });

    it('filters png whatever the case', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'Png',
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toContain('.png');
    });

    it('filters gif in uppercase', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'GIF',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Animation.gif');
    });
  });

  describe('sortBy', () => {
    it('date_desc puts the newest first', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        sortBy: 'date_desc',
      });
      expect(result[0].label).toBe('Animation.gif'); // 2026-03-01
      expect(result[1].label).toBe('banniere.jpeg'); // 2026-02-01
      expect(result[2].label).toBe('logo.jpg'); // 2026-01-01
      expect(result[3].label).toBe('icone.png'); // null → epoch → le plus ancien
    });

    it('date_asc puts the oldest first, a missing date counting as the epoch', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        sortBy: 'date_asc',
      });
      expect(result[0].label).toBe('icone.png'); // null → epoch → le plus ancien
      expect(result[3].label).toBe('Animation.gif'); // 2026-03-01
    });
  });

  describe('combinations', () => {
    it('combines search and format', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        search: 'ban',
        format: 'jpg',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('banniere.jpeg');
    });

    it('combines format and sortBy', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'jpg',
        sortBy: 'date_desc',
      });
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('banniere.jpeg'); // 2026-02-01
      expect(result[1].label).toBe('logo.jpg'); // 2026-01-01
    });
  });
});

// Cases the editor's search box brings in (US-06): the server never trimmed,
// and a query format was compared raw against an already-normalised extension.
describe('filterGalleryFiles — cases the editor search box brings in', () => {
  it('ignores whitespace around the needle', () => {
    const result = filterGalleryFiles(TEST_FILES, { search: '  logo  ' });
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('logo.jpg');
  });

  it('treats a whitespace-only needle as no search at all', () => {
    expect(filterGalleryFiles(TEST_FILES, { search: '   ' })).toHaveLength(
      TEST_FILES.length
    );
  });

  it('accepts jpeg as a filter value, not only as an extension', () => {
    const result = filterGalleryFiles(TEST_FILES, { format: 'jpeg' });
    expect(result.map((f) => f.label).sort()).toEqual([
      'banniere.jpeg',
      'logo.jpg',
    ]);
  });

  it('finds an accented label', () => {
    const result = filterGalleryFiles(
      [{ name: 'a-sep.gif', label: 'séparateur.gif' }],
      { search: 'séparateur' }
    );
    expect(result).toHaveLength(1);
  });

  it('falls back to the file name when the label is missing', () => {
    const result = filterGalleryFiles([{ name: 'abc-promo.png' }], {
      search: 'promo',
    });
    expect(result).toHaveLength(1);
  });

  it('does not file an extension-less name under any format', () => {
    expect(
      filterGalleryFiles([{ name: 'sans-extension' }], { format: 'jpg' })
    ).toHaveLength(0);
  });

  // macOS writes file names decomposed: the label stored for an accented name
  // holds c + U+0327 and e + U+0301, while the search box emits the composed form.
  describe('Unicode normalisation', () => {
    const NFD = {
      name: 'abc-ca.png',
      label: 'mon image \u0063\u0327a\u0065\u0301.png',
    };
    const NFC = { name: 'abc-cb.png', label: 'dossier caf\u00e9.png' };

    it('finds an NFD label from NFC input', () => {
      expect(filterGalleryFiles([NFD], { search: 'ça\u00e9' })).toHaveLength(1);
    });

    it('finds an NFC label from NFD input', () => {
      expect(
        filterGalleryFiles([NFC], { search: 'caf\u0065\u0301' })
      ).toHaveLength(1);
    });

    it('searches without regard to accents', () => {
      expect(filterGalleryFiles([NFD], { search: 'cae' })).toHaveLength(1);
      expect(filterGalleryFiles([NFC], { search: 'cafe' })).toHaveLength(1);
    });

    it('still accepts accented input', () => {
      expect(filterGalleryFiles([NFC], { search: 'café' })).toHaveLength(1);
    });

    it('stays case-insensitive on an accented character', () => {
      expect(filterGalleryFiles([NFC], { search: 'CAFÉ' })).toHaveLength(1);
    });

    it('does not conflate two distinct labels', () => {
      expect(filterGalleryFiles([NFD, NFC], { search: 'cafe' })).toHaveLength(
        1
      );
    });
  });

  it('does not mutate the array it was given', () => {
    const input = [...TEST_FILES];
    filterGalleryFiles(input, { sortBy: 'date_desc' });
    expect(input).toEqual(TEST_FILES);
  });

  it('keeps the given order when no sort is asked for', () => {
    const result = filterGalleryFiles(TEST_FILES, { search: '' });
    expect(result.map((f) => f.name)).toEqual(TEST_FILES.map((f) => f.name));
  });
});

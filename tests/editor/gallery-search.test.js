/**
 * @jest-environment jsdom
 */
'use strict';

// US-06 — the gallery panel's search derives from the Knockout mirror rather
// than replacing it. These tests exercise the component's own computed options,
// without mounting Vue: what matters is the data flow, not the rendering.

const {
  filterGalleryFiles,
} = require('../../packages/shared/gallery/filter.js');

// The computed block as galleryPlugin defines it, bound to a plain object. If
// the plugin ever starts filtering `images` in place, these break.
const computed = {
  visibleImages() {
    return filterGalleryFiles(this.images, {
      search: this.search,
      format: this.format,
      sortBy: this.sortBy,
    });
  },
  count() {
    return this.visibleImages.length;
  },
  isSearching() {
    return this.search.trim() !== '';
  },
  isFiltering() {
    return this.isSearching || this.format !== '';
  },
  hasNoResult() {
    return this.isFiltering && this.count === 0;
  },
};

function panel(images, search = '', format = '', sortBy = 'date_desc') {
  const vm = { images, search, format, sortBy };
  Object.keys(computed).forEach((key) => {
    Object.defineProperty(vm, key, { get: computed[key], enumerable: true });
  });
  return vm;
}

const IMAGES = [
  { name: 'abc-logo.jpg', label: 'logo.jpg' },
  { name: 'abc-banniere.png', label: 'bannière été.png' },
  { name: 'abc-promo.gif', label: 'PROMO.gif' },
];

describe('gallery panel — search', () => {
  it('shows every image when the search is empty', () => {
    expect(panel(IMAGES).visibleImages).toHaveLength(3);
    expect(panel(IMAGES).hasNoResult).toBe(false);
  });

  it('counts the filtered images, not the whole gallery', () => {
    expect(panel(IMAGES, 'logo').count).toBe(1);
    expect(panel(IMAGES).count).toBe(3);
  });

  it('matches regardless of case', () => {
    expect(panel(IMAGES, 'promo').count).toBe(1);
    expect(panel(IMAGES, 'PROMO').count).toBe(1);
  });

  it('matches an accented label', () => {
    expect(panel(IMAGES, 'bannière').count).toBe(1);
  });

  it('reports a no-result state only while actually searching', () => {
    expect(panel(IMAGES, 'zzz').hasNoResult).toBe(true);
    expect(panel([], '').hasNoResult).toBe(false);
    expect(panel(IMAGES, '   ').hasNoResult).toBe(false);
  });

  // The invariant this US rests on: Mosaico keeps mutating `images` on upload
  // and delete, so filtering must never touch it.
  it('never mutates the Knockout mirror it reads', () => {
    const images = [...IMAGES];
    const vm = panel(images, 'logo');
    expect(vm.visibleImages).toHaveLength(1);
    expect(images).toEqual(IMAGES);
    expect(vm.images).toBe(images);
  });

  it('picks up an image pushed into the mirror while a filter is active', () => {
    const images = [...IMAGES];
    const vm = panel(images, 'facture');
    expect(vm.hasNoResult).toBe(true);

    images.unshift({ name: 'abc-facture.jpg', label: 'facture.jpg' });

    expect(vm.count).toBe(1);
    expect(vm.hasNoResult).toBe(false);
  });
});

// US-07 — format chips and date sort, on top of the same single predicate call
describe('gallery panel — filters and sort', () => {
  const DATED = [
    { name: 'a-un.jpg', label: 'un.jpg', uploadedAt: new Date('2026-01-01') },
    {
      name: 'a-deux.png',
      label: 'deux.png',
      uploadedAt: new Date('2026-03-01'),
    },
    {
      name: 'a-trois.gif',
      label: 'trois.gif',
      uploadedAt: new Date('2026-02-01'),
    },
    {
      name: 'a-quatre.jpeg',
      label: 'quatre.jpeg',
      uploadedAt: new Date('2026-04-01'),
    },
  ];

  it('keeps every image on the neutral format chip', () => {
    expect(panel(DATED, '', '').count).toBe(4);
  });

  it('narrows to a format', () => {
    expect(panel(DATED, '', 'png').count).toBe(1);
    expect(panel(DATED, '', 'gif').count).toBe(1);
  });

  it('counts a jpeg under the JPG chip', () => {
    const result = panel(DATED, '', 'jpg').visibleImages;
    expect(result.map((f) => f.label).sort()).toEqual([
      'quatre.jpeg',
      'un.jpg',
    ]);
  });

  // No neutral sort chip: a gallery filled one image at a time already loads
  // newest first, so the panel opens on that order explicitly rather than
  // relying on the document's insertion order.
  it('opens on the newest-first order', () => {
    expect(panel(DATED).visibleImages.map((f) => f.label)).toEqual([
      'quatre.jpeg',
      'deux.png',
      'trois.gif',
      'un.jpg',
    ]);
  });

  it('keeps images with the same timestamp in their loaded order', () => {
    const sameDay = [
      {
        name: 'a-1.jpg',
        label: 'premier.jpg',
        uploadedAt: new Date('2026-01-01'),
      },
      {
        name: 'a-2.jpg',
        label: 'second.jpg',
        uploadedAt: new Date('2026-01-01'),
      },
      {
        name: 'a-3.jpg',
        label: 'troisieme.jpg',
        uploadedAt: new Date('2026-01-01'),
      },
    ];
    expect(panel(sameDay).visibleImages.map((f) => f.label)).toEqual([
      'premier.jpg',
      'second.jpg',
      'troisieme.jpg',
    ]);
  });

  it('sorts newest first', () => {
    expect(
      panel(DATED, '', '', 'date_desc').visibleImages.map((f) => f.label)
    ).toEqual(['quatre.jpeg', 'deux.png', 'trois.gif', 'un.jpg']);
  });

  it('sorts oldest first', () => {
    expect(
      panel(DATED, '', '', 'date_asc').visibleImages.map((f) => f.label)
    ).toEqual(['un.jpg', 'trois.gif', 'deux.png', 'quatre.jpeg']);
  });

  it('combines a search, a format and a sort', () => {
    const images = [
      {
        name: 'a-logo1.jpg',
        label: 'logo bleu.jpg',
        uploadedAt: new Date('2026-01-01'),
      },
      {
        name: 'a-logo2.jpg',
        label: 'logo rouge.jpg',
        uploadedAt: new Date('2026-05-01'),
      },
      {
        name: 'a-logo3.png',
        label: 'logo vert.png',
        uploadedAt: new Date('2026-03-01'),
      },
    ];
    const result = panel(images, 'logo', 'jpg', 'date_desc').visibleImages;
    expect(result.map((f) => f.label)).toEqual([
      'logo rouge.jpg',
      'logo bleu.jpg',
    ]);
  });

  it('reports an empty result for a format the gallery has none of', () => {
    const onlyJpg = [{ name: 'a-x.jpg', label: 'x.jpg' }];
    const vm = panel(onlyJpg, '', 'gif');
    expect(vm.count).toBe(0);
    expect(vm.hasNoResult).toBe(true);
  });

  it('does not claim a dead end on an empty gallery with no filter', () => {
    expect(panel([], '', '', 'date_desc').hasNoResult).toBe(false);
    expect(panel([], '', '', 'date_asc').hasNoResult).toBe(false);
  });

  it('never mutates the mirror while filtering or sorting', () => {
    const images = [...DATED];
    const result = panel(images, '', 'jpg', 'date_desc').visibleImages;
    expect(result).toHaveLength(2);
    expect(images).toEqual(DATED);
  });
});

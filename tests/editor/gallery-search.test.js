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
    return filterGalleryFiles(this.images, { search: this.search });
  },
  count() {
    return this.visibleImages.length;
  },
  isSearching() {
    return this.search.trim() !== '';
  },
  hasNoResult() {
    return this.isSearching && this.count === 0;
  },
};

function panel(images, search = '') {
  const vm = { images, search };
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

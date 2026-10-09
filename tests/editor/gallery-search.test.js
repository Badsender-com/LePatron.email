/**
 * @jest-environment jsdom
 */
'use strict';

// US-06 / US-07 — the gallery panel's search, format filter and date sort.
//
// These drive the REAL component options returned by createGalleryPanel, not a
// copy of them: a regression in galleryPlugin.js has to fail here. Only the
// jQuery UI widget the drag directive pulls in is stubbed — the gulp build
// resolves it, plain Node does not.
jest.mock('jquery-ui/ui/widgets/draggable', () => ({}), { virtual: true });

const {
  createGalleryPanel,
} = require('../../packages/editor/src/js/vue/galleryPlugin.js');

// the panel reads its copy through the Mosaico viewModel's translator
const fakeViewModel = {
  t: (key, params) => (params ? `${key}:${params.count}` : key),
};

const options = createGalleryPanel(fakeViewModel);

// Bind the component's own computed getters to a plain object standing in for a
// Vue instance. Vue resolves `this` the same way, so the getters under test are
// exactly the ones that ship.
function panel(images, search = '', format = '', sortBy = 'date_desc') {
  const vm = { ...options.data(), images, search, format, sortBy };
  Object.keys(options.computed).forEach((key) => {
    Object.defineProperty(vm, key, {
      get: options.computed[key],
      enumerable: true,
    });
  });
  Object.keys(options.methods).forEach((key) => {
    vm[key] = options.methods[key].bind(vm);
  });
  return vm;
}

const IMAGES = [
  { name: 'abc-logo.jpg', label: 'logo.jpg' },
  { name: 'abc-banniere.png', label: 'bannière été.png' },
  { name: 'abc-promo.gif', label: 'PROMO.gif' },
];

const DATED = [
  { name: 'a-un.jpg', label: 'un.jpg', uploadedAt: new Date('2026-01-01') },
  { name: 'a-deux.png', label: 'deux.png', uploadedAt: new Date('2026-03-01') },
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

describe('gallery panel — defaults', () => {
  it('opens on every format and on the newest-first sort', () => {
    const vm = options.data();
    expect(vm.format).toBe('');
    expect(vm.sortBy).toBe('date_desc');
    expect(vm.search).toBe('');
  });

  // Module-level arrays put straight into data() would be observed once by Vue
  // and shared by both panel instances (mailing and template).
  it('gives each instance its own chip arrays', () => {
    expect(options.data().formats).not.toBe(options.data().formats);
    expect(options.data().sorts).not.toBe(options.data().sorts);
  });
});

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

  it('matches an accented label, with or without the accents', () => {
    expect(panel(IMAGES, 'bannière').count).toBe(1);
    expect(panel(IMAGES, 'banniere').count).toBe(1);
  });

  it('reports a no-result state only while actually filtering', () => {
    expect(panel(IMAGES, 'zzz').hasNoResult).toBe(true);
    expect(panel([], '').hasNoResult).toBe(false);
    expect(panel(IMAGES, '   ').hasNoResult).toBe(false);
  });

  it('tells an empty gallery apart from a dead-end filter', () => {
    expect(panel([], '').isEmptyGallery).toBe(true);
    expect(panel(IMAGES, 'zzz').isEmptyGallery).toBe(false);
  });

  // The invariant US-06 rests on: Mosaico keeps mutating `images` on upload and
  // delete, so filtering must never touch it.
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

describe('gallery panel — filters and sort', () => {
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

  it('sorts oldest first', () => {
    expect(
      panel(DATED, '', '', 'date_asc').visibleImages.map((f) => f.label)
    ).toEqual(['un.jpg', 'trois.gif', 'deux.png', 'quatre.jpeg']);
  });

  it('combines a search, a format and a sort', () => {
    const images = [
      {
        name: 'a-1.jpg',
        label: 'logo bleu.jpg',
        uploadedAt: new Date('2026-01-01'),
      },
      {
        name: 'a-2.jpg',
        label: 'logo rouge.jpg',
        uploadedAt: new Date('2026-05-01'),
      },
      {
        name: 'a-3.png',
        label: 'logo vert.png',
        uploadedAt: new Date('2026-03-01'),
      },
    ];
    expect(
      panel(images, 'logo', 'jpg', 'date_desc').visibleImages.map(
        (f) => f.label
      )
    ).toEqual(['logo rouge.jpg', 'logo bleu.jpg']);
  });

  it('reports an empty result for a format the gallery has none of', () => {
    const vm = panel([{ name: 'a-x.jpg', label: 'x.jpg' }], '', 'gif');
    expect(vm.count).toBe(0);
    expect(vm.hasNoResult).toBe(true);
  });

  it('never mutates the mirror while filtering or sorting', () => {
    const images = [...DATED];
    const result = panel(images, '', 'jpg', 'date_desc').visibleImages;
    expect(result).toHaveLength(2);
    expect(images).toEqual(DATED);
  });
});

describe('gallery panel — accessible names', () => {
  // WCAG 2.5.3: the accessible name must contain the visible label, or a
  // voice-control user saying "Date" cannot activate the chip.
  it('makes each sort chip name a superset of its visible text', () => {
    const vm = panel(IMAGES);
    ['date_desc', 'date_asc'].forEach((sortBy) => {
      expect(vm.sortTitle(sortBy)).toContain(vm.sortLabel(sortBy));
    });
  });
});

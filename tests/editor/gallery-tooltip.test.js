/**
 * @jest-environment jsdom
 */
'use strict';

// US-09 — the metadata tooltip.

const Vue = require('vue/dist/vue.common');
const Tooltip = require('../../packages/editor/src/js/vue/components/gallery/tooltip.js');

const STRINGS = {
  locale: 'fr-FR',
  dimensions: 'Dimensions',
  format: 'Format',
  uploadedAt: 'Added on',
};

// a cell in the middle of the panel, with room above it
const ANCHOR = { left: 120, right: 230, top: 300, bottom: 410, width: 110 };
const BOUNDS = {
  left: 100,
  right: 464,
  top: 100,
  bottom: 700,
  width: 364,
  height: 600,
};

const FILE = {
  name: '6a2135b7f802c2a6f99a4242-abc.png',
  label: 'mon image.png',
  width: 1200,
  height: 800,
  uploadedAt: '2026-03-15T10:00:00.000Z',
};

function mount(props = {}) {
  const Component = Vue.extend(Tooltip);
  return new Component({
    propsData: {
      file: FILE,
      anchor: ANCHOR,
      bounds: BOUNDS,
      strings: STRINGS,
      ...props,
    },
  }).$mount();
}

// The tooltip IS the component's root element, so it has to be matched rather
// than searched for inside itself. When `v-if` is false Vue renders a comment
// node, which has no `matches`.
const root = (vm) =>
  vm.$el.matches && vm.$el.matches('[data-gallery-tooltip]') ? vm.$el : null;
const text = (vm) => vm.$el.textContent.replace(/\s+/g, ' ').trim();

describe('gallery tooltip — what it shows', () => {
  it('shows the full label, the dimensions, the format and the date', () => {
    const vm = mount();
    const content = text(vm);
    expect(content).toContain('mon image.png');
    expect(content).toContain('1200 × 800 px');
    expect(content).toContain('PNG');
    expect(content).toContain('Dimensions');
    vm.$destroy();
  });

  it('renders nothing at all when no file is hovered', () => {
    const vm = mount({ file: null });
    expect(root(vm)).toBeNull();
    vm.$destroy();
  });

  // Anything stored before US-09 whose bytes could not be read back has none.
  // The line is dropped rather than claiming "0 × 0".
  it('drops the dimensions line when they are unknown', () => {
    const vm = mount({ file: { ...FILE, width: null, height: null } });
    expect(
      vm.$el.querySelector('[data-gallery-tooltip-dimensions]')
    ).toBeNull();
    expect(text(vm)).toContain('mon image.png');
    expect(text(vm)).toContain('PNG');
    vm.$destroy();
  });

  it('drops the dimensions line when only one of the two is known', () => {
    const vm = mount({ file: { ...FILE, height: 0 } });
    expect(
      vm.$el.querySelector('[data-gallery-tooltip-dimensions]')
    ).toBeNull();
    vm.$destroy();
  });

  it('falls back to the file name when the image has no label', () => {
    const vm = mount({ file: { ...FILE, label: null } });
    expect(text(vm)).toContain('6a2135b7f802c2a6f99a4242-abc.png');
    vm.$destroy();
  });

  it('shows the format in upper case, from the stored name', () => {
    const vm = mount({ file: { ...FILE, name: 'abc.JpG' } });
    expect(text(vm)).toContain('JPG');
    vm.$destroy();
  });

  // The browser's locale is not the editor's: a French interface was printing
  // "8 October 2026".
  it('formats the date in the editor language, not the browser one', () => {
    const vm = mount();
    expect(text(vm)).toContain('15 mars 2026');
    vm.$destroy();
  });

  it('drops the date line rather than printing an invalid one', () => {
    const vm = mount({ file: { ...FILE, uploadedAt: 'not a date' } });
    expect(text(vm)).not.toContain('Added on');
    vm.$destroy();
  });
});

describe('gallery tooltip — where it sits', () => {
  // The sidebar is 364px wide: a tooltip centred on a cell in the last column
  // would hang off the edge of the panel.
  it('stays inside the panel for a cell in the last column', () => {
    const lastColumn = {
      left: 340,
      right: 450,
      top: 300,
      bottom: 410,
      width: 110,
    };
    const vm = mount({ anchor: lastColumn });
    const left = parseFloat(vm.position.left);
    const width = parseFloat(vm.position.width);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(BOUNDS.width);
    vm.$destroy();
  });

  it('stays inside the panel for a cell in the first column', () => {
    const firstColumn = {
      left: 104,
      right: 214,
      top: 300,
      bottom: 410,
      width: 110,
    };
    const vm = mount({ anchor: firstColumn });
    expect(parseFloat(vm.position.left)).toBeGreaterThanOrEqual(0);
    vm.$destroy();
  });

  it('never grows wider than the panel', () => {
    const narrow = { ...BOUNDS, width: 200, right: 300 };
    const vm = mount({ bounds: narrow });
    expect(parseFloat(vm.position.width)).toBeLessThanOrEqual(200);
    vm.$destroy();
  });

  // The side is whichever has more room. Comparing the space above against a
  // guessed tooltip height is what put a 117px tooltip flush against the top
  // edge of the panel the first time round.
  it('opens below a cell near the top, where the room is', () => {
    const nearTop = {
      left: 120,
      right: 230,
      top: 140,
      bottom: 250,
      width: 110,
    };
    const vm = mount({ anchor: nearTop });
    expect(vm.position.top).not.toBe('auto');
    expect(vm.position.bottom).toBe('auto');
    vm.$destroy();
  });

  it('opens above a cell near the bottom, where the room is', () => {
    const nearBottom = {
      left: 120,
      right: 230,
      top: 560,
      bottom: 670,
      width: 110,
    };
    const vm = mount({ anchor: nearBottom });
    expect(vm.position.bottom).not.toBe('auto');
    expect(vm.position.top).toBe('auto');
    vm.$destroy();
  });

  // Whichever side it picks, it is capped to the room on that side — so it
  // cannot be cut off by the panel's own edge.
  it('never asks for more height than the side it chose has', () => {
    const cases = [
      { left: 120, right: 230, top: 140, bottom: 250, width: 110 },
      { left: 120, right: 230, top: 560, bottom: 670, width: 110 },
      ANCHOR,
    ];
    cases.forEach((anchor) => {
      const vm = mount({ anchor });
      const maxHeight = parseFloat(vm.position.maxHeight);
      const edge =
        vm.position.top === 'auto'
          ? parseFloat(vm.position.bottom)
          : parseFloat(vm.position.top);
      expect(maxHeight).toBeGreaterThan(0);
      expect(maxHeight + edge).toBeLessThanOrEqual(BOUNDS.height);
      vm.$destroy();
    });
  });

  it('renders nothing before it knows where the cell is', () => {
    expect(root(mount({ anchor: null }))).toBeNull();
    expect(root(mount({ bounds: null }))).toBeNull();
  });
});

describe('gallery tooltip — it is not a target', () => {
  // It follows what the pointer is aiming at; catching the pointer itself
  // would make the thumbnail underneath unreachable.
  it('declares itself a tooltip, not an interactive element', () => {
    const vm = mount();
    expect(root(vm).getAttribute('role')).toBe('tooltip');
    expect(root(vm).querySelector('button')).toBeNull();
    expect(root(vm).querySelector('a')).toBeNull();
    vm.$destroy();
  });
});

/**
 * @jest-environment jsdom
 */
'use strict';

// US-11 — renaming a gallery image from its thumbnail.
//
// Drives the real component, mounted, rather than a copy of its options: the
// whole point of the story is an interaction, and an interaction that only
// exists in a test double proves nothing.

const Vue = require('vue/dist/vue.common');
const Thumb = require('../../packages/editor/src/js/vue/components/gallery/thumb.js');

const STRINGS = {
  remove: 'remove',
  renameHint: 'rename-hint',
  renameInput: 'rename-input',
};

const FILE = {
  name: '6a2135b7f802c2a6f99a4242-abc.png',
  label: 'mon image.png',
  thumbnailUrl: '/api/images/cover/111x111/6a2135b7f802c2a6f99a4242-abc.png',
};

function mount(file = FILE) {
  const Component = Vue.extend(Thumb);
  return new Component({ propsData: { file, strings: STRINGS } }).$mount();
}

const label = (vm) => vm.$el.querySelector('[data-gallery-label]');
const input = (vm) => vm.$el.querySelector('[data-gallery-label-input]');

describe('thumbnail rename — entering edit mode', () => {
  it('shows the label, not an input, at rest', () => {
    const vm = mount();
    expect(label(vm).textContent.trim()).toBe('mon image.png');
    expect(input(vm)).toBeNull();
    vm.$destroy();
  });

  it('swaps the label for an input on double-click', async () => {
    const vm = mount();
    label(vm).dispatchEvent(new Event('dblclick'));
    await Vue.nextTick();
    expect(input(vm)).not.toBeNull();
    expect(input(vm).value).toBe('mon image.png');
    vm.$destroy();
  });

  // A double-click is invisible to anyone who does not know it and impossible
  // on a keyboard; the band is focusable and Enter opens the same editor.
  it('opens the same editor from the keyboard', async () => {
    const vm = mount();
    expect(label(vm).getAttribute('tabindex')).toBe('0');
    vm.startEdit();
    await Vue.nextTick();
    expect(input(vm)).not.toBeNull();
    vm.$destroy();
  });

  it('selects the whole name, since a rename usually replaces it', async () => {
    const vm = mount();
    document.body.appendChild(vm.$el);
    vm.startEdit();
    await Vue.nextTick();
    const el = input(vm);
    expect(el.selectionStart).toBe(0);
    expect(el.selectionEnd).toBe('mon image.png'.length);
    vm.$destroy();
  });
});

describe('thumbnail rename — committing', () => {
  it('emits the new label on Enter', async () => {
    const vm = mount();
    const emitted = [];
    vm.$on('rename', (file, next) => emitted.push(next));
    vm.startEdit();
    await Vue.nextTick();

    const el = input(vm);
    el.value = 'par la touche entree.png';
    el.dispatchEvent(new Event('input'));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13 }));
    await Vue.nextTick();

    expect(emitted).toEqual(['par la touche entree.png']);
    expect(input(vm)).toBeNull();
    vm.$destroy();
  });

  it('emits rename with the file and the cleaned label', async () => {
    const vm = mount();
    const emitted = [];
    vm.$on('rename', (file, next) => emitted.push([file, next]));
    vm.startEdit();
    await Vue.nextTick();
    vm.draft = '  nouveau   nom.png  ';
    vm.commitEdit();
    expect(emitted).toHaveLength(1);
    expect(emitted[0][0]).toBe(FILE);
    // sanitised the same way the server will sanitise it
    expect(emitted[0][1]).toBe('nouveau nom.png');
    vm.$destroy();
  });

  it('says nothing when the label comes back unchanged', async () => {
    const vm = mount();
    const emitted = [];
    vm.$on('rename', () => emitted.push(1));
    vm.startEdit();
    await Vue.nextTick();
    vm.commitEdit();
    expect(emitted).toHaveLength(0);
    vm.$destroy();
  });

  it('refuses an empty label rather than leaving nothing to read', async () => {
    const vm = mount();
    const emitted = [];
    vm.$on('rename', () => emitted.push(1));
    vm.startEdit();
    await Vue.nextTick();
    vm.draft = '   ';
    vm.commitEdit();
    expect(emitted).toHaveLength(0);
    expect(vm.editing).toBe(false);
    vm.$destroy();
  });

  it('commits on blur as well as on Enter', async () => {
    const vm = mount();
    const emitted = [];
    vm.$on('rename', (file, next) => emitted.push(next));
    vm.startEdit();
    await Vue.nextTick();
    vm.draft = 'par le focus.png';
    input(vm).dispatchEvent(new Event('blur'));
    await Vue.nextTick();
    expect(emitted).toEqual(['par le focus.png']);
    vm.$destroy();
  });

  it('drops the change on Escape', async () => {
    const vm = mount();
    const emitted = [];
    vm.$on('rename', () => emitted.push(1));
    vm.startEdit();
    await Vue.nextTick();
    vm.draft = 'jamais enregistré.png';
    vm.cancelEdit();
    await Vue.nextTick();
    expect(emitted).toHaveLength(0);
    expect(input(vm)).toBeNull();
    expect(label(vm).textContent.trim()).toBe('mon image.png');
    vm.$destroy();
  });

  it('caps what can be typed at the length the server accepts', async () => {
    const vm = mount();
    vm.startEdit();
    await Vue.nextTick();
    expect(Number(input(vm).getAttribute('maxlength'))).toBe(255);
    vm.$destroy();
  });
});

describe('thumbnail rename — recycling', () => {
  // The scroller reuses a view for another image. An edit left open would
  // otherwise carry its input — and its draft — onto a different file.
  it('closes the editor when the cell is recycled onto another image', async () => {
    const vm = mount();
    vm.startEdit();
    await Vue.nextTick();
    expect(input(vm)).not.toBeNull();

    vm.file = {
      name: '6a2135b7f802c2a6f99a4242-def.png',
      label: 'autre image.png',
      thumbnailUrl: '/api/images/cover/111x111/x.png',
    };
    await Vue.nextTick();

    expect(input(vm)).toBeNull();
    expect(label(vm).textContent.trim()).toBe('autre image.png');
    vm.$destroy();
  });
});

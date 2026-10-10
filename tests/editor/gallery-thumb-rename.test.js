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
  renameAction: 'Rename __label__',
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
  // on a keyboard. The band is a real <button>, so Enter and Space both reach
  // it — dispatch the event rather than calling the method, or removing the
  // handler would keep this green.
  it('opens the same editor with Enter on the label', async () => {
    const vm = mount();
    label(vm).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 })
    );
    await Vue.nextTick();
    expect(input(vm)).not.toBeNull();
    vm.$destroy();
  });

  // A <button> answers to Space for free; a div with role="button" did not.
  it('is a real button, so the platform gives it Space', () => {
    const vm = mount();
    expect(label(vm).tagName).toBe('BUTTON');
    expect(label(vm).getAttribute('type')).toBe('button');
    vm.$destroy();
  });

  // The name is action + object. It used to repeat "double-click to rename" on
  // every cell — an instruction, and one a keyboard user cannot follow.
  it('names the control by what it does to which image', () => {
    const vm = mount();
    expect(label(vm).getAttribute('aria-label')).toBe('Rename mon image.png');
    // the tooltip stays the full name: at 118px the label is usually truncated
    // and this is the only way to read it
    expect(label(vm).getAttribute('title')).toBe('mon image.png');
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
    const renamed = [];
    const rejected = [];
    vm.$on('rename', () => renamed.push(1));
    vm.$on('reject', (key) => rejected.push(key));
    vm.startEdit();
    await Vue.nextTick();
    vm.draft = '   ';
    vm.commitEdit();
    expect(renamed).toHaveLength(0);
    // and says so: the label used to just snap back in silence
    expect(rejected).toEqual(['gallery-rename-image-empty']);
    expect(vm.editing).toBe(false);
    vm.$destroy();
  });

  // Enter also confirms an IME candidate. Committing then saves a half-composed
  // word and closes the editor mid-sentence.
  it('ignores an Enter that is confirming an IME composition', async () => {
    const vm = mount();
    const emitted = [];
    vm.$on('rename', (file, next) => emitted.push(next));
    vm.startEdit();
    await Vue.nextTick();
    vm.draft = 'composition.png';

    vm.onEnter({ isComposing: true, keyCode: 13 });
    expect(emitted).toHaveLength(0);
    expect(vm.editing).toBe(true);

    vm.onEnter({ isComposing: false, keyCode: 13 });
    expect(emitted).toEqual(['composition.png']);
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

describe('thumbnail rename — collisions with the other actions', () => {
  // A single click anywhere on the thumbnail inserts the image into the
  // selected block. Clicking away to dismiss an open editor would therefore
  // both save the rename AND mutate the email.
  it('does not insert the image while an editor is open', async () => {
    const vm = mount();
    const selected = [];
    vm.$on('select', () => selected.push(1));

    vm.$el.dispatchEvent(new Event('click'));
    expect(selected).toHaveLength(1);

    vm.startEdit();
    await Vue.nextTick();
    vm.$el.dispatchEvent(new Event('click'));
    expect(selected).toHaveLength(1);
    vm.$destroy();
  });

  // The label band stops the click, or the first click of a double-click would
  // insert the image before the editor ever opened (ADR-0002).
  it('does not insert the image when the label itself is clicked', () => {
    const vm = mount();
    const selected = [];
    vm.$on('select', () => selected.push(1));
    label(vm).dispatchEvent(new Event('click', { bubbles: true }));
    expect(selected).toHaveLength(0);
    vm.$destroy();
  });

  // Blur commits, so clicking the delete button used to save a rename on an
  // image that was about to be removed.
  it('drops an open edit when the delete button is pressed', async () => {
    const vm = mount();
    const renamed = [];
    vm.$on('rename', () => renamed.push(1));
    vm.startEdit();
    await Vue.nextTick();
    vm.draft = 'jamais enregistre.png';

    vm.$el
      .querySelector('.gallery-thumb__remove')
      .dispatchEvent(new Event('mousedown'));
    input(vm) && input(vm).dispatchEvent(new Event('blur'));
    await Vue.nextTick();

    expect(renamed).toHaveLength(0);
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

  // The gallery replaces entries rather than mutating them, so the SAME image
  // arrives as a new object whenever anything in the list changes. Closing the
  // editor then would throw away a draft for no reason.
  it('keeps the editor open when the same image arrives as a new object', async () => {
    const vm = mount();
    vm.startEdit();
    await Vue.nextTick();
    vm.draft = 'en cours de frappe.png';

    vm.file = Object.assign({}, FILE);
    await Vue.nextTick();

    expect(input(vm)).not.toBeNull();
    expect(vm.draft).toBe('en cours de frappe.png');
    vm.$destroy();
  });
});

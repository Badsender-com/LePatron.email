/**
 * @jest-environment jsdom
 */
'use strict';

// Renaming a gallery image from its thumbnail, around the edit itself: the
// other actions, the scroller recycling the cell, and where the focus goes
// once the field closes. The edit is in gallery-thumb-rename.test.js.

const Vue = require('vue/dist/vue.common');
const Thumb = require('../../packages/editor/src/js/vue/components/gallery/thumb.js');

const { STRINGS, NONE, FILE, mountThumb } = require('./helpers/thumb.js');

const mount = (file) => mountThumb(file);

const label = (vm) => vm.$el.querySelector('[data-gallery-label]');
const input = (vm) => vm.$el.querySelector('[data-gallery-label-input]');

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
  // insert the image before the editor ever opened (ADR-0005).
  it('does not insert the image when the label itself is clicked', () => {
    const vm = mount();
    const selected = [];
    vm.$on('select', () => selected.push(1));
    label(vm).dispatchEvent(new Event('click', { bubbles: true }));
    expect(selected).toHaveLength(0);
    vm.$destroy();
  });

  // The stop exists for the rename double-click only. Without the right to
  // rename, the band is part of the tile, and a click on it inserts.
  it('inserts the image from the label for a user who cannot rename', () => {
    const Component = Vue.extend(Thumb);
    const vm = new Component({
      propsData: { file: FILE, strings: STRINGS, actions: NONE },
    }).$mount();
    const selected = [];
    vm.$on('select', () => selected.push(1));

    label(vm).dispatchEvent(new Event('click', { bubbles: true }));

    expect(selected).toHaveLength(1);
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
      .querySelector('[data-gallery-remove]')
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

describe('thumbnail rename — where the focus goes', () => {
  let vm;

  // attached: focus only exists in a document
  beforeEach(() => {
    vm = mount();
    document.body.appendChild(vm.$el);
  });

  afterEach(() => {
    vm.$destroy();
    document.body.innerHTML = '';
  });

  const renameButton = () => vm.$el.querySelector('[data-gallery-rename]');
  const press = (key, keyCode) =>
    input(vm).dispatchEvent(
      new KeyboardEvent('keydown', { key, keyCode, bubbles: true })
    );

  // The field leaves the DOM with the focus in it, which then fell to the
  // page's body: a keyboard user started over from the top of the editor.
  it('goes back to the rename button once Enter has committed', async () => {
    renameButton().click();
    await Vue.nextTick();
    input(vm).value = 'nouveau.png';
    input(vm).dispatchEvent(new Event('input'));
    press('Enter', 13);
    await Vue.nextTick();

    expect(document.activeElement).toBe(renameButton());
  });

  // The focus is back on the button before the browser has finished with
  // that Enter: its keypress then landed on the button, which a keypress of
  // Enter activates, and the field opened again (seen in Chrome). An Enter
  // whose keydown is handled has no keypress.
  it('does not let the committing Enter reach the rename button', async () => {
    renameButton().click();
    await Vue.nextTick();
    input(vm).value = 'nouveau.png';
    input(vm).dispatchEvent(new Event('input'));
    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      keyCode: 13,
      bubbles: true,
      cancelable: true,
    });
    input(vm).dispatchEvent(enter);

    expect(enter.defaultPrevented).toBe(true);
  });

  it('goes back to the rename button once Escape has cancelled', async () => {
    renameButton().click();
    await Vue.nextTick();
    press('Escape', 27);
    await Vue.nextTick();

    expect(document.activeElement).toBe(renameButton());
  });

  it('goes to the rename button as well after a double-click rename', async () => {
    label(vm).dispatchEvent(new Event('dblclick'));
    await Vue.nextTick();
    press('Escape', 27);
    await Vue.nextTick();

    expect(document.activeElement).toBe(renameButton());
  });

  // Leaving the field for somewhere else commits too, and the focus is
  // where the user put it.
  it('stays where the user took it when the field loses the focus', async () => {
    const elsewhere = document.createElement('input');
    document.body.appendChild(elsewhere);
    renameButton().click();
    await Vue.nextTick();

    elsewhere.focus();
    await Vue.nextTick();

    expect(input(vm)).toBeNull();
    expect(document.activeElement).toBe(elsewhere);
  });
});

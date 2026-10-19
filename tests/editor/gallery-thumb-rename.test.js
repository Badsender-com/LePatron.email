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

const { FILE, mountThumb } = require('./helpers/thumb.js');

const mount = (file) => mountThumb(file);

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

  // jQuery UI's draggable excludes `input, textarea, button, select, option`
  // from its drag handle. A <button> here therefore carved a dead strip out of
  // the thumbnail's drag area, and the whole tile — image and label — has to
  // stay draggable onto the email.
  it('leaves the label as a plain element, so the tile stays draggable', () => {
    const vm = mount();
    const el = label(vm);
    expect(el.tagName).toBe('DIV');
    expect(el.getAttribute('role')).toBeNull();
    expect(el.getAttribute('tabindex')).toBeNull();
    vm.$destroy();
  });

  // At 118px the label is usually truncated. Reading the whole name is the
  // metadata tooltip's job (US-09); a native `title` here would pop a second,
  // differently-styled tooltip over the first one on the same hover.
  it('leaves the full name to the metadata tooltip', () => {
    const vm = mount();
    expect(label(vm).getAttribute('title')).toBeNull();
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
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 })
    );
    await Vue.nextTick();

    expect(emitted).toEqual(['par la touche entree.png']);
    expect(input(vm)).toBeNull();
    vm.$destroy();
  });

  // A button acts on the press of Enter, and the field it opens takes the
  // focus before the key is released: that release lands on the field. Read
  // on keyup, it committed the unchanged label and closed the field in the
  // very keystroke that opened it.
  it('stays open when the Enter that opened it is released', async () => {
    const vm = mount();
    document.body.appendChild(vm.$el);
    const button = vm.$el.querySelector('[data-gallery-rename]');
    button.focus();

    // what a browser does for Enter on a button: keydown, click, keyup
    const enter = { key: 'Enter', keyCode: 13, bubbles: true };
    button.dispatchEvent(new KeyboardEvent('keydown', enter));
    button.click();
    await Vue.nextTick();
    expect(document.activeElement).toBe(input(vm));
    document.activeElement.dispatchEvent(new KeyboardEvent('keyup', enter));
    await Vue.nextTick();

    expect(input(vm)).not.toBeNull();
    expect(vm.editing).toBe(true);
    vm.$destroy();
    vm.$el.remove();
  });

  it('drops the change when Escape is pressed in the field', async () => {
    const vm = mount();
    const emitted = [];
    vm.$on('rename', () => emitted.push(1));
    vm.startEdit();
    await Vue.nextTick();
    vm.draft = 'jamais enregistré.png';

    input(vm).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 })
    );
    await Vue.nextTick();

    expect(emitted).toHaveLength(0);
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

    // The flags describe the keydown of the key that picks a candidate; by
    // its keyup the composition is over, so the guard has to sit on keydown.
    const press = (init) =>
      input(vm).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ...init })
      );
    press({ isComposing: true, keyCode: 13 });
    press({ keyCode: 229 });
    await Vue.nextTick();
    expect(emitted).toHaveLength(0);
    expect(vm.editing).toBe(true);

    press({ keyCode: 13 });
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

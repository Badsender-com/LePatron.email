/**
 * @jest-environment jsdom
 */
'use strict';

// US-08 — the actions revealed on a thumbnail at hover.
//
// Drives the real component, mounted. The appearance itself is CSS and is not
// asserted here; what is asserted is everything the markup has to get right
// for that CSS, and for the three actions, to work at all.

const Vue = require('vue/dist/vue.common');
const Thumb = require('../../packages/editor/src/js/vue/components/gallery/thumb.js');

const STRINGS = {
  remove: 'Supprimer __label__',
  editAction: 'Modifier __label__',
  renameAction: 'Renommer __label__',
  renameInput: 'rename-input',
};

const ALL = { rename: true, edit: true, remove: true };
const NONE = { rename: false, edit: false, remove: false };

const FILE = {
  name: '6a2135b7f802c2a6f99a4242-abc.png',
  label: 'mon image.png',
  thumbnailUrl: '/api/images/cover/111x111/6a2135b7f802c2a6f99a4242-abc.png',
};

function mount(file = FILE) {
  const Component = Vue.extend(Thumb);
  return new Component({
    propsData: { file, strings: STRINGS, actions: ALL },
  }).$mount();
}

const edit = (vm) => vm.$el.querySelector('[data-gallery-edit]');
const rename = (vm) => vm.$el.querySelector('[data-gallery-rename]');
const remove = (vm) => vm.$el.querySelector('[data-gallery-remove]');
const overlay = (vm) => vm.$el.querySelector('[data-gallery-overlay]');

describe('thumbnail actions — what the overlay holds', () => {
  it('offers edit, rename and delete', () => {
    const vm = mount();
    expect(edit(vm)).not.toBeNull();
    expect(rename(vm)).not.toBeNull();
    expect(remove(vm)).not.toBeNull();
    vm.$destroy();
  });

  // They are real buttons, so they are reachable with a keyboard — which is
  // the only path to renaming that exists, the label's double-click being
  // impossible to perform without a pointer.
  it('makes each action a real button, not a clickable div', () => {
    const vm = mount();
    [edit(vm), rename(vm), remove(vm)].forEach((button) => {
      expect(button.tagName).toBe('BUTTON');
      // without this, a button inside the editor's forms submits them
      expect(button.getAttribute('type')).toBe('button');
    });
    vm.$destroy();
  });

  // Three unlabelled icons repeated on every cell: "delete" alone does not
  // say which image, in a screen reader's list of buttons or to voice control.
  it('names the image in each accessible name', () => {
    const vm = mount();
    expect(edit(vm).getAttribute('aria-label')).toBe('Modifier mon image.png');
    expect(rename(vm).getAttribute('aria-label')).toBe(
      'Renommer mon image.png'
    );
    expect(remove(vm).getAttribute('aria-label')).toBe(
      'Supprimer mon image.png'
    );
    vm.$destroy();
  });

  // `String.replace` with a string reads `$&` and its kin as patterns
  it('names an image whose label holds a replacement pattern as it is', () => {
    const vm = mount({ ...FILE, label: "a $& b $' c.png" });
    expect(remove(vm).getAttribute('aria-label')).toBe(
      "Supprimer a $& b $' c.png"
    );
    vm.$destroy();
  });

  it('shows the same text on hover as it gives to assistive technology', () => {
    const vm = mount();
    [edit(vm), rename(vm), remove(vm)].forEach((button) => {
      expect(button.getAttribute('title')).toBe(
        button.getAttribute('aria-label')
      );
    });
    vm.$destroy();
  });

  it('falls back to the file name when the image has no label', () => {
    const vm = mount({ ...FILE, label: null });
    expect(remove(vm).getAttribute('aria-label')).toBe(
      'Supprimer 6a2135b7f802c2a6f99a4242-abc.png'
    );
    vm.$destroy();
  });
});

describe('thumbnail actions — where the overlay sits', () => {
  // ADR-0005: the overlay lives in the image area, never over the label band.
  // The band is what a rename double-clicks, and an overlay across it would
  // have swallowed that gesture. It is the image control's sibling, not its
  // child: buttons inside a `role="button"` are not read as buttons.
  it('renders inside the image area, not over the label band', () => {
    const vm = mount();
    const media = vm.$el.querySelector('.gallery-thumb__media');
    expect(media.contains(overlay(vm))).toBe(true);
    expect(media.contains(vm.$el.querySelector('[data-gallery-pick]'))).toBe(
      true
    );
    expect(overlay(vm).closest('[role="button"]')).toBeNull();
    expect(
      overlay(vm).contains(vm.$el.querySelector('[data-gallery-label]'))
    ).toBe(false);
    vm.$destroy();
  });

  // The old single ✕ in the corner is gone: the same action now lives in the
  // bar, and two delete buttons on one thumbnail is one too many.
  it('leaves no second delete button behind', () => {
    const vm = mount();
    expect(vm.$el.querySelectorAll('[data-gallery-remove]')).toHaveLength(1);
    expect(vm.$el.querySelector('.gallery-thumb__remove')).toBeNull();
    vm.$destroy();
  });

  // A focus inside the bar keeps it shown (gallery-vue-thumb.less). Taken
  // from a click, it kept the bar up on that thumbnail while the pointer was
  // over another one; so only the keyboard puts it there.
  it('lets no click put the focus in the bar', () => {
    const vm = mount();
    [edit(vm), rename(vm), remove(vm)].forEach((button) => {
      const press = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      });
      button.dispatchEvent(press);
      expect(press.defaultPrevented).toBe(true);
    });
    vm.$destroy();
  });
});

describe('thumbnail actions — what each one does', () => {
  it('asks for the editor without also inserting the image', () => {
    const vm = mount();
    const edited = [];
    const selected = [];
    vm.$on('edit', (file) => edited.push(file));
    vm.$on('select', (file) => selected.push(file));

    edit(vm).dispatchEvent(new Event('click', { bubbles: true }));

    expect(edited).toEqual([FILE]);
    // a single click on the thumbnail inserts the image into the email; the
    // action buttons sit on top of that and must not trigger it too
    expect(selected).toHaveLength(0);
    vm.$destroy();
  });

  it('opens the inline editor from the rename button', async () => {
    const vm = mount();
    const selected = [];
    vm.$on('select', (file) => selected.push(file));

    rename(vm).dispatchEvent(new Event('click', { bubbles: true }));
    await Vue.nextTick();

    expect(vm.$el.querySelector('[data-gallery-label-input]')).not.toBeNull();
    expect(selected).toHaveLength(0);
    vm.$destroy();
  });

  it('asks for deletion without also inserting the image', () => {
    const vm = mount();
    const removed = [];
    const selected = [];
    vm.$on('remove', (file) => removed.push(file));
    vm.$on('select', (file) => selected.push(file));

    remove(vm).dispatchEvent(new Event('click', { bubbles: true }));

    expect(removed).toEqual([FILE]);
    expect(selected).toHaveLength(0);
    vm.$destroy();
  });
});

describe('thumbnail actions — what cannot be edited', () => {
  // The upload pipeline skips the editor for GIF and SVG because it flattens
  // what it opens: an animated GIF would come back as one still frame. The
  // button is dropped rather than disabled — clicking it would have
  // re-uploaded identical bytes, which the content-addressed name turns into
  // a no-op nothing on screen reports.
  it('offers no editor on a GIF', () => {
    const vm = mount({ ...FILE, name: 'abc.gif', label: 'animation.gif' });
    expect(edit(vm)).toBeNull();
    // the other two still apply
    expect(rename(vm)).not.toBeNull();
    expect(remove(vm)).not.toBeNull();
    vm.$destroy();
  });

  it('offers no editor on an SVG', () => {
    const vm = mount({ ...FILE, name: 'abc.svg', label: 'logo.svg' });
    expect(edit(vm)).toBeNull();
    vm.$destroy();
  });

  it('offers the editor on JPG, JPEG and PNG alike', () => {
    ['abc.jpg', 'abc.JPEG', 'abc.png'].forEach((name) => {
      const vm = mount({ ...FILE, name });
      expect(edit(vm)).not.toBeNull();
      vm.$destroy();
    });
  });
});

// The thumbnail shows what the server will accept and nothing else
// (AGENTS.md, "Rights"). The panel decides it (ext/gallery-actions.js,
// covered role by role in access/gallery-actions.test.js) and hands it down;
// here the prop is driven directly.
describe('thumbnail actions — who may use them', () => {
  function mountWith(actions) {
    const Component = Vue.extend(Thumb);
    return new Component({
      propsData: { file: FILE, strings: STRINGS, actions },
    }).$mount();
  }

  it('offers no action at all when none is allowed', () => {
    const vm = mountWith(NONE);
    expect(overlay(vm)).not.toBeNull();
    expect(vm.$el.querySelector('.gallery-thumb__actions')).toBeNull();
    vm.$destroy();
  });

  // a template's gallery, for whoever does not own the templates
  it('offers edit and delete without rename when only the rename is denied', async () => {
    const vm = mountWith({ ...ALL, rename: false });
    expect(edit(vm)).not.toBeNull();
    expect(remove(vm)).not.toBeNull();
    expect(rename(vm)).toBeNull();
    vm.$el
      .querySelector('[data-gallery-label]')
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await Vue.nextTick();
    expect(vm.$el.querySelector('[data-gallery-label-input]')).toBeNull();
    vm.$destroy();
  });

  it('ignores the double-click on the label when renaming is denied', async () => {
    const vm = mountWith(NONE);
    vm.$el
      .querySelector('[data-gallery-label]')
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await Vue.nextTick();
    expect(vm.$el.querySelector('[data-gallery-label-input]')).toBeNull();
    vm.$destroy();
  });

  it('is denied by default: a panel that says nothing grants nothing', () => {
    const vm = mountWith(undefined);
    expect(vm.actions).toEqual(NONE);
    expect(vm.$el.querySelector('.gallery-thumb__actions')).toBeNull();
    vm.$destroy();
  });
});

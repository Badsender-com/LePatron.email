/**
 * @jest-environment jsdom
 */

'use strict';

// The builder by keyboard alone (docs/UX_GUIDELINES.md, "Keyboard
// Navigation"): the element list is a listbox that Tab reaches and the arrows
// walk, every icon-only button says what it does, and every setting is labelled.

const Vue = require('vue/dist/vue.common');

const { open, unmountAll } = require('./modal-helpers.js');

async function openWith(types) {
  const { modal } = open(null, { showDialogGallery: () => false });
  types.forEach((type) => modal.addElement(type));
  await Vue.nextTick();
  return modal;
}

const options = () =>
  Array.from(document.querySelectorAll('.bb-modal__list [role="option"]'));

function press(target, key) {
  const event = new window.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(unmountAll);

describe('the element list', () => {
  it('is a labelled listbox of options', async () => {
    await openWith(['text', 'button']);

    const list = document.querySelector('.bb-modal__list');
    expect(list.getAttribute('role')).toBe('listbox');
    const label = document.getElementById(list.getAttribute('aria-labelledby'));
    expect(label.textContent).toBe('block-builder-elements');
    expect(options()).toHaveLength(2);
  });

  // One Tab stop for the whole list, on the selected option.
  it('puts the only tab stop on the selected option', async () => {
    await openWith(['text', 'button', 'divider']);

    expect(options().map((option) => option.tabIndex)).toEqual([-1, -1, 0]);
    expect(options()[2].getAttribute('aria-selected')).toBe('true');
    expect(options()[0].getAttribute('aria-selected')).toBe('false');
  });

  it('selects with Enter and with Space', async () => {
    const modal = await openWith(['text', 'button']);

    press(options()[0], 'Enter');
    expect(modal.selected.type).toBe('text');

    press(options()[1], ' ');
    expect(modal.selected.type).toBe('button');
  });

  it('walks the list with the arrows, focus following', async () => {
    const modal = await openWith(['text', 'button', 'divider']);

    press(options()[2], 'ArrowUp');
    await Vue.nextTick();

    expect(modal.selected.type).toBe('button');
    expect(document.activeElement).toBe(options()[1]);
  });

  it('stops at the ends of the list', async () => {
    const modal = await openWith(['text', 'button']);

    press(options()[1], 'ArrowDown');

    expect(modal.selected.type).toBe('button');
  });
});

describe('the reorder buttons', () => {
  const buttons = () =>
    Array.from(document.querySelectorAll('.bb-modal__actions button'));

  it('say what they do, in the editor language', async () => {
    await openWith(['text']);

    expect(
      buttons().map((button) => button.getAttribute('aria-label'))
    ).toEqual([
      'block-builder-move-up',
      'block-builder-move-down',
      'block-builder-remove',
    ]);
  });

  it('are disabled where moving would do nothing', async () => {
    const modal = await openWith(['text', 'button']);

    // The last element is selected: it can go up, not down.
    expect(buttons()[0].disabled).toBe(false);
    expect(buttons()[1].disabled).toBe(true);

    modal.selectedId = modal.state.elements[0].id;
    await Vue.nextTick();

    expect(buttons()[0].disabled).toBe(true);
    expect(buttons()[1].disabled).toBe(false);
  });
});

describe('the settings panel', () => {
  it('ties every input to its label', async () => {
    await openWith(['button']);

    const inputs = document.querySelectorAll('.bb-settings input');
    expect(inputs.length).toBeGreaterThan(0);
    inputs.forEach((input) => {
      const label = document.querySelector(`label[for="${input.id}"]`);
      expect(label).not.toBeNull();
    });
  });

  it('labels the controls that are not inputs', async () => {
    await openWith(['text']);

    const group = document.querySelector('.bb-settings__group');
    expect(group.getAttribute('role')).toBe('group');
    expect(
      document.getElementById(group.getAttribute('aria-labelledby')).textContent
    ).toBe('block-builder-field-align');

    const rich = document.querySelector('.bb-rich__field');
    expect(
      document.getElementById(rich.getAttribute('aria-labelledby')).textContent
    ).toBe('block-builder-field-text');
  });

  it('says which alignment is on', async () => {
    await openWith(['text']);

    const pressed = Array.from(
      document.querySelectorAll('.bb-settings__choice'),
      (choice) => choice.getAttribute('aria-pressed')
    );
    // The text default is left.
    expect(pressed).toEqual(['true', 'false', 'false']);
  });
});

describe('the preview width toggles', () => {
  it('say which width is on', async () => {
    const modal = await openWith([]);
    const toggles = () =>
      Array.from(document.querySelectorAll('.bb-modal__toolbar button'));

    expect(toggles().map((t) => t.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
    ]);

    modal.previewWidth = modal.mobileWidth;
    await Vue.nextTick();

    expect(toggles().map((t) => t.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
    ]);
  });
});

/**
 * @jest-environment jsdom
 */

'use strict';

// Escape and a backdrop click dismiss the modal; a composition lives only in it
// until applied. A stray Escape used to throw the work away without a word —
// and an Escape meant for the image gallery or a TinyMCE dialog, opened from
// the modal, closed the modal too, since it listens on the whole document.

const Vue = require('vue/dist/vue.common');

const { open, unmountAll } = require('./modal-helpers.js');

async function openModal(vmOverrides) {
  const { modal } = open(null, {
    showDialogGallery: () => false,
    ...vmOverrides,
  });
  await Vue.nextTick();
  return modal;
}

const isOpen = (modal) => modal.$refs.modalRef.isOpen;

function pressEscape(target) {
  const event = new window.KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
  });
  (target || document).dispatchEvent(event);
}

let confirm;

beforeEach(() => {
  confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
});

afterEach(() => {
  confirm.mockRestore();
  unmountAll();
});

describe('dismissing an untouched composition', () => {
  it('closes on Escape without asking', async () => {
    const modal = await openModal();

    pressEscape();

    expect(confirm).not.toHaveBeenCalled();
    expect(isOpen(modal)).toBe(false);
  });
});

describe('dismissing a modified composition', () => {
  it('asks before closing on Escape', async () => {
    const modal = await openModal();
    modal.addElement('text');

    pressEscape();

    expect(confirm).toHaveBeenCalledWith('block-builder-discard-confirm');
  });

  it('keeps the composition when the user declines', async () => {
    const modal = await openModal();
    modal.addElement('text');

    pressEscape();

    expect(isOpen(modal)).toBe(true);
    expect(modal.state.elements).toHaveLength(1);
  });

  it('closes and forgets it when the user accepts', async () => {
    confirm.mockReturnValue(true);
    const modal = await openModal();
    modal.addElement('text');

    pressEscape();

    expect(isOpen(modal)).toBe(false);
    expect(modal.state.elements).toEqual([]);
  });

  it('asks on a click on the backdrop too', async () => {
    const modal = await openModal();
    modal.addElement('text');

    document.querySelector('.bs-modal-overlay').click();

    expect(confirm).toHaveBeenCalled();
    expect(isOpen(modal)).toBe(true);
  });

  // Cancel says what it means; only an accidental dismissal is questioned.
  it('does not ask on Cancel', async () => {
    const modal = await openModal();
    modal.addElement('text');

    modal.closeModal();

    expect(confirm).not.toHaveBeenCalled();
    expect(isOpen(modal)).toBe(false);
  });
});

describe('an Escape meant for a dialog opened from the modal', () => {
  it('is ignored while the image gallery is open', async () => {
    const modal = await openModal({ showDialogGallery: () => true });

    pressEscape();

    expect(isOpen(modal)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  // TinyMCE closes its own window on that Escape before the document hears it:
  // what is left to go on is where the event came from.
  it('is ignored when it comes from a TinyMCE dialog', async () => {
    const modal = await openModal();
    const dialog = document.createElement('div');
    dialog.className = 'mce-container mce-window';
    const input = document.createElement('input');
    dialog.appendChild(input);
    document.body.appendChild(dialog);

    pressEscape(input);

    expect(isOpen(modal)).toBe(true);
  });

  it('is ignored while a TinyMCE window is open', async () => {
    const modal = await openModal();
    const dialog = document.createElement('div');
    dialog.className = 'mce-window';
    document.body.appendChild(dialog);

    pressEscape();

    expect(isOpen(modal)).toBe(true);
  });
});

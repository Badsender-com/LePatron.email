/**
 * @jest-environment jsdom
 */

'use strict';

// What finally lands in the block. The builder writes markup and state
// through the accessors it is handed — that both go in one undo step is pinned
// against the real undo stack in apply-undo.test.js. Everything downstream is
// the machinery already in production.

const {
  open,
  mountModal,
  makeAccessor,
  unmountAll,
} = require('./modal-helpers.js');
const {
  HTML_CODE_MAX_LENGTH,
} = require('../../../packages/shared/synthetic-blocks.js');

afterEach(unmountAll);

describe('applying', () => {
  it('writes the generated markup through the accessor', () => {
    const { modal, written } = open();
    modal.addElement('text');
    modal.applySetting({ key: 'content', value: 'Bonjour' });

    modal.handleApply();

    expect(written).toHaveLength(1);
    expect(written[0]).toContain('Bonjour');
    expect(written[0]).toContain('<table role="presentation"');
  });

  // Applied, an oversized composition would fail every autosave after it, with
  // a message about a block the user does not have. Refused here, it can still
  // be cut down.
  describe('past the size limit', () => {
    function oversized() {
      const context = open();
      context.modal.addElement('text');
      context.modal.applySetting({
        key: 'content',
        value: 'x'.repeat(HTML_CODE_MAX_LENGTH + 1),
      });
      context.modal.handleApply();
      return context;
    }

    it('writes nothing and says why', () => {
      const { modal, written, stateAccessor } = oversized();

      expect(written).toEqual([]);
      expect(stateAccessor.writes).toEqual([]);
      expect(modal.tooLarge).toBe(true);
    });

    it('stays open on the composition', () => {
      const { modal } = oversized();

      expect(modal.state.elements).toHaveLength(1);
    });

    it('drops the message once the composition changes', () => {
      const { modal } = oversized();

      modal.applySetting({ key: 'content', value: 'Court' });

      expect(modal.tooLarge).toBe(false);
    });
  });

  // Emptying a block is a composition too: with Apply disabled on an empty
  // list, the last element could be removed but never written away. The empty
  // block then exports nothing (strip-empty-blocks.js).
  it('applies an empty composition, emptying the block', () => {
    const { modal, accessor, stateAccessor } = open();
    modal.addElement('text');
    modal.handleApply();

    const reopened = open({
      markup: accessor.writes[0],
      state: stateAccessor.writes[0],
    });
    reopened.modal.removeSelected();
    reopened.modal.handleApply();

    expect(reopened.written).toEqual(['']);
    expect(JSON.parse(reopened.stateAccessor.writes[0]).elements).toEqual([]);
  });

  it('writes nothing when closed without applying', () => {
    const { modal, written, stateAccessor } = open();
    modal.addElement('text');

    modal.closeModal();

    expect(written).toEqual([]);
    expect(stateAccessor.writes).toEqual([]);
  });

  it('forgets the composition once closed', () => {
    const { modal } = open();
    modal.addElement('text');

    modal.closeModal();

    expect(modal.state.elements).toEqual([]);
    expect(modal.selected).toBeNull();
  });
});

describe('choosing an image', () => {
  it('hands the gallery a setter for the selected element', () => {
    const { vm, modal } = open();
    modal.addElement('image');

    modal.pickImage('src');

    expect(vm.showDialogGallery).toHaveBeenCalledWith(true);
    expect(vm.currentBgimage).toHaveBeenCalledTimes(1);

    // The gallery calls the setter with the absolute URL it built.
    const setter = vm.currentBgimage.mock.calls[0][0];
    setter('https://images.example.com/visual.png');

    expect(modal.selected.src).toBe('https://images.example.com/visual.png');
  });

  it('writes the chosen image into the markup', () => {
    const { vm, modal, written } = open();
    modal.addElement('image');
    modal.pickImage('src');
    vm.currentBgimage.mock.calls[0][0]('https://images.example.com/v.png');

    modal.handleApply();

    expect(written[0]).toContain('src="https://images.example.com/v.png"');
  });

  // An older editor bundle, or a build without the background image widget.
  it('does nothing when the gallery is not available', () => {
    const { modal } = mountModal({
      currentBgimage: undefined,
      showDialogGallery: undefined,
    });
    modal.handleToggle(true, { accessor: makeAccessor('') });
    modal.addElement('image');

    expect(() => modal.pickImage('src')).not.toThrow();
  });
});

/**
 * @jest-environment jsdom
 */

'use strict';

// The composing surface. What matters here is the state machine behind it —
// what gets added, selected, moved, removed, and what finally lands in the
// block — rather than the pixels, which the gallery covers in real clients.
//
// The one contract worth stating out loud: the builder writes markup and state
// through the accessors it is handed, and writes them in a single undo step.
// Everything downstream is the machinery already in production, and this test
// pins that it stays so.

const Vue = require('vue/dist/vue.common');

const {
  BlockBuilderModalComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/block-builder-modal.js');

function mountModal(overrides) {
  // `currentBgimage` and `showDialogGallery` are the editor's own gallery
  // dialog, set up by the background image widget. The builder borrows them
  // rather than shipping a picker of its own.
  const vm = {
    t: (key) => key,
    startMultiple: jest.fn(),
    stopMultiple: jest.fn(),
    currentBgimage: jest.fn(),
    showDialogGallery: jest.fn(),
    ...overrides,
  };

  const host = document.createElement('div');
  document.body.appendChild(host);

  const app = new Vue({
    el: host,
    components: { BlockBuilderModal: BlockBuilderModalComponent },
    data: { vm },
    template: '<block-builder-modal :vm="vm" />',
  });

  return { vm, modal: app.$children[0] };
}

/**
 * A stand-in for a Knockout observable: called with no argument it reads,
 * called with one it writes. The modal reads both accessors when it opens, so a
 * mock that recorded every call as a write would count those reads too.
 */
function makeAccessor(initial) {
  const writes = [];
  let value = initial === undefined ? '' : initial;
  const accessor = (next) => {
    if (next === undefined) return value;
    value = next;
    writes.push(next);
    return value;
  };
  accessor.writes = writes;
  return accessor;
}

/**
 * Opens the modal on a pair of accessors.
 *
 * @param {Object} [stored] `{ markup, state }` already on the block
 */
function open(stored) {
  const accessor = makeAccessor((stored && stored.markup) || '');
  const stateAccessor = makeAccessor((stored && stored.state) || '');
  const { vm, modal } = mountModal();

  modal.handleToggle(true, { accessor, stateAccessor });

  return { vm, modal, accessor, stateAccessor, written: accessor.writes };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('composing', () => {
  it('starts empty', () => {
    const { modal } = open();

    expect(modal.state.elements).toEqual([]);
    expect(modal.isEmpty).toBe(true);
    expect(modal.html).toBe('');
  });

  it('adds an element with its defaults and selects it', () => {
    const { modal } = open();

    modal.addElement('button');

    expect(modal.state.elements).toHaveLength(1);
    expect(modal.selected.type).toBe('button');
    // The template default, not an empty object.
    expect(modal.selected.backgroundColor).toBe('#000000');
  });

  it('gives every element a distinct id', () => {
    const { modal } = open();

    modal.addElement('text');
    modal.addElement('text');

    const [first, second] = modal.state.elements;
    expect(first.id).not.toBe(second.id);
  });

  it('renders what has been added', () => {
    const { modal } = open();

    modal.addElement('text');
    modal.applySetting({ key: 'content', value: 'Bonjour' });

    expect(modal.html).toContain('Bonjour');
  });

  it('applies a setting to the selected element only', () => {
    const { modal } = open();
    modal.addElement('text');
    const first = modal.selected.id;
    const untouched = modal.selected.content;
    modal.addElement('text');

    modal.applySetting({ key: 'content', value: 'Second' });

    // Still whatever it held — the seed, here — and certainly not the value
    // written into its neighbour.
    expect(modal.state.elements.find((e) => e.id === first).content).toBe(
      untouched
    );
    expect(modal.selected.content).toBe('Second');
  });

  it('ignores a setting when nothing is selected', () => {
    const { modal } = open();
    expect(() =>
      modal.applySetting({ key: 'content', value: 'x' })
    ).not.toThrow();
  });
});

describe('reordering and removing', () => {
  function withThree() {
    const context = open();
    ['text', 'button', 'divider'].forEach((type) =>
      context.modal.addElement(type)
    );
    return context;
  }

  const types = (modal) => modal.state.elements.map((element) => element.type);

  it('moves the selected element up', () => {
    const { modal } = withThree();

    modal.move(-1);

    expect(types(modal)).toEqual(['text', 'divider', 'button']);
  });

  it('moves it down', () => {
    const { modal } = withThree();
    modal.selectedId = modal.state.elements[0].id;

    modal.move(1);

    expect(types(modal)).toEqual(['button', 'text', 'divider']);
  });

  it('does not move past either end', () => {
    const { modal } = withThree();
    modal.selectedId = modal.state.elements[0].id;

    modal.move(-1);
    expect(types(modal)).toEqual(['text', 'button', 'divider']);

    modal.selectedId = modal.state.elements[2].id;
    modal.move(1);
    expect(types(modal)).toEqual(['text', 'button', 'divider']);
  });

  it('removes the selected element and selects a neighbour', () => {
    const { modal } = withThree();
    modal.selectedId = modal.state.elements[1].id;

    modal.removeSelected();

    expect(types(modal)).toEqual(['text', 'divider']);
    expect(modal.selected.type).toBe('divider');
  });

  it('clears the selection when the last element goes', () => {
    const { modal } = open();
    modal.addElement('text');

    modal.removeSelected();

    expect(modal.selected).toBeNull();
    expect(modal.html).toBe('');
  });
});

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

  // The undo stack copies the whole model on every entry: a composition must
  // cost one step, not one per keystroke.
  it('costs a single undo step', () => {
    const { vm, modal } = open();
    modal.addElement('text');

    modal.handleApply();

    expect(vm.startMultiple).toHaveBeenCalledTimes(1);
    expect(vm.stopMultiple).toHaveBeenCalledTimes(1);
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

describe('re-opening a block', () => {
  /**
   * The state a previous session actually stored — taken from what the accessor
   * received, not re-serialised after the fact: applying closes the modal and
   * resets its state, so reading it afterwards would capture an empty one.
   */
  function composedState() {
    const { modal, stateAccessor } = open();
    modal.addElement('text');
    modal.applySetting({ key: 'content', value: 'Déjà écrit' });
    modal.addElement('divider');
    modal.handleApply();
    return stateAccessor.writes[0];
  }

  it('restores what was composed before', () => {
    const { modal } = open({ markup: '<p>x</p>', state: composedState() });

    expect(modal.state.elements.map((e) => e.type)).toEqual([
      'text',
      'divider',
    ]);
    expect(modal.state.elements[0].content).toBe('Déjà écrit');
  });

  it('selects the first element, so the panel is not empty', () => {
    const { modal } = open({ markup: '<p>x</p>', state: composedState() });

    expect(modal.selected).not.toBeNull();
  });

  it('writes both the markup and the state when applied', () => {
    const { modal, written, stateAccessor } = open();
    modal.addElement('text');

    modal.handleApply();

    expect(written).toHaveLength(1);
    expect(stateAccessor.writes).toHaveLength(1);
    expect(JSON.parse(stateAccessor.writes[0]).elements).toHaveLength(1);
  });

  // The case a user meets the first time they compose on a block they had
  // written by hand: the composition replaces that markup, and saying so before
  // they click is the whole point.
  describe('markup with no state behind it', () => {
    it('warns that composing would replace it', () => {
      const { modal } = open({ markup: '<p>écrit à la main</p>', state: '' });

      expect(modal.replacesExistingMarkup).toBe(true);
      expect(modal.state.elements).toEqual([]);
    });

    it('says nothing on an empty block', () => {
      const { modal } = open({ markup: '', state: '' });

      expect(modal.replacesExistingMarkup).toBe(false);
    });

    it('says nothing when the state restores', () => {
      const { modal } = open({ markup: '<p>x</p>', state: composedState() });

      expect(modal.replacesExistingMarkup).toBe(false);
    });

    // Unreadable state and existing markup: the composition is gone either way,
    // so the warning must still show.
    it('warns when the stored state cannot be read', () => {
      const { modal } = open({ markup: '<p>x</p>', state: '{broken' });

      expect(modal.replacesExistingMarkup).toBe(true);
    });
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

describe('the element list', () => {
  it('labels an element by its type', () => {
    const { modal } = open();
    modal.addElement('divider');

    expect(modal.labelFor(modal.selected)).toBe('Séparateur');
  });

  // Five texts in a row are indistinguishable without this.
  it('shows the first words of a text', () => {
    const { modal } = open();
    modal.addElement('text');
    modal.applySetting({ key: 'content', value: '<strong>Un titre</strong>' });

    expect(modal.labelFor(modal.selected)).toBe('Texte — Un titre');
  });

  it('shows the label of a button', () => {
    const { modal } = open();
    modal.addElement('button');
    modal.applySetting({ key: 'label', value: 'Je découvre' });

    expect(modal.labelFor(modal.selected)).toBe('Bouton — Je découvre');
  });
});

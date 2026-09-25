/**
 * @jest-environment jsdom
 */

'use strict';

// The composing surface. What matters here is the state machine behind it —
// what gets added, selected, moved, removed, and what finally lands in the
// block — rather than the pixels, which the gallery covers in real clients.
//
// The one contract worth stating out loud: the builder writes into the SAME
// property the code editor writes by hand. Everything downstream is the
// machinery already in production, and this test pins that it stays so.

const Vue = require('vue/dist/vue.common');

const {
  BlockBuilderModalComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/block-builder-modal.js');

function mountModal() {
  const vm = {
    t: (key) => key,
    startMultiple: jest.fn(),
    stopMultiple: jest.fn(),
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

/** Opens the modal on a fake Knockout accessor and returns both. */
function open() {
  const written = [];
  const accessor = jest.fn((value) => written.push(value));
  const { vm, modal } = mountModal();

  modal.handleToggle(true, { accessor });

  return { vm, modal, accessor, written };
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
    modal.addElement('text');

    modal.applySetting({ key: 'content', value: 'Second' });

    expect(modal.state.elements.find((e) => e.id === first).content).toBe('');
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
    const { modal, accessor, written } = open();
    modal.addElement('text');
    modal.applySetting({ key: 'content', value: 'Bonjour' });

    modal.handleApply();

    expect(accessor).toHaveBeenCalled();
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
    const { modal, accessor } = open();
    modal.addElement('text');

    modal.closeModal();

    expect(accessor).not.toHaveBeenCalled();
  });

  it('forgets the composition once closed', () => {
    const { modal } = open();
    modal.addElement('text');

    modal.closeModal();

    expect(modal.state.elements).toEqual([]);
    expect(modal.selected).toBeNull();
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

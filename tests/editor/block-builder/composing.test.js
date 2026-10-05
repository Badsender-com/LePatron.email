/**
 * @jest-environment jsdom
 */

'use strict';

// The composing surface. What matters here is the state machine behind it —
// what gets added, selected, moved and removed — rather than the pixels, which
// the gallery covers in real clients.

const { open, unmountAll } = require('./modal-helpers.js');

afterEach(unmountAll);

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

describe('the element list', () => {
  it('labels an element by its type', () => {
    const { modal } = open();
    modal.addElement('divider');

    expect(modal.labelFor(modal.selected)).toBe(
      'block-builder-element-divider'
    );
  });

  // Five texts in a row are indistinguishable without this.
  it('shows the first words of a text', () => {
    const { modal } = open();
    modal.addElement('text');
    modal.applySetting({ key: 'content', value: '<strong>Un titre</strong>' });

    expect(modal.labelFor(modal.selected)).toBe(
      'block-builder-element-text — Un titre'
    );
  });

  // TinyMCE writes `&nbsp;` and `&amp;`: the list shows the words, not them.
  it('decodes the character references of a text', () => {
    const { modal } = open();
    modal.addElement('text');
    modal.applySetting({
      key: 'content',
      value: 'Un titre qui&nbsp;<b>dit</b> A &amp; B',
    });

    expect(modal.labelFor(modal.selected)).toBe(
      'block-builder-element-text — Un titre qui dit A & B'
    );
  });

  it('shows the label of a button', () => {
    const { modal } = open();
    modal.addElement('button');
    modal.applySetting({ key: 'label', value: 'Je découvre' });

    expect(modal.labelFor(modal.selected)).toBe(
      'block-builder-element-button — Je découvre'
    );
  });
});

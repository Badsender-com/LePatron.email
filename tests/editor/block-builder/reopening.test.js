/**
 * @jest-environment jsdom
 */

'use strict';

// Re-opening a composed block: the state it was composed from comes back, and
// the user is told before applying would replace or rebuild the stored markup.

const { open, unmountAll } = require('./modal-helpers.js');
const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  parseState,
} = require('../../../packages/shared/block-builder/state.js');

afterEach(unmountAll);

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

  // The stored markup is frozen until the user applies, and applying rebuilds
  // it from the state with the current generator.
  describe('markup the current generator would not write', () => {
    it('says that applying rebuilds it', () => {
      const { modal } = open({ markup: '<p>x</p>', state: composedState() });

      expect(modal.rebuildsMarkup).toBe(true);
    });

    it('says nothing when the stored markup is what applying would write', () => {
      const state = composedState();
      const markup = generate(parseState(state));

      const { modal } = open({ markup, state });

      expect(modal.rebuildsMarkup).toBe(false);
    });
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

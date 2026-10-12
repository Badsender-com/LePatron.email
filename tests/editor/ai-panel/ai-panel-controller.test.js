'use strict';

/**
 * The AI panel's controller (ext/ai-panel/ai-panel-controller.js), outside
 * any component (#1192): what the panel lists, following the canvas
 * selection, and opening an action on its target. The panel only renders it.
 */

const ko = require('knockout');
const {
  createAiPanel,
} = require('../../../packages/editor/src/js/ext/ai-panel/ai-panel-controller');
const {
  ACTIONS,
} = require('../../../packages/editor/src/js/ext/ai-panel/actions');

const CONTEXT = {
  textGeneration: true,
  hasSubject: true,
  hasSubjectField: true,
  hasPreheaderField: true,
};

const block = (type, id) => ({ type: () => type, id: () => id });
const COVER = block('coverBlock', 'ko_coverBlock_1');
const PREHEADER_BLOCK = block('preheaderBlock', 'ko_preheaderBlock_1');

function mount({ context = CONTEXT, definitions } = {}) {
  const isOpen = ko.observable(false);
  const selection = ko.observable(null);
  const fieldSelection = ko.observable(null);
  let edited = null;
  // The editor's undo stack: each step calls back.
  const history = ko.observable(0);
  const editor = {
    context: () => context,
    onHistory(callback) {
      const subscription = history.subscribe(callback);
      return () => subscription.dispose();
    },
  };
  const panel = createAiPanel({
    ko,
    editor,
    api: { generate: jest.fn() },
    isOpen,
    selection,
    fieldSelection,
    editedField: () => edited,
    definitions,
  });
  // The user clicks in a field: the editor selects it, and it is being edited.
  const editField = (target, block) => {
    edited = target;
    selection(block);
    fieldSelection({});
  };
  // The focus leaves the field (to the panel), with no new selection.
  const blur = () => {
    edited = null;
  };
  return { panel, isOpen, selection, editField, blur, history };
}

const ids = (actions) => actions.map((action) => action.id);

describe('ai panel: the controller', () => {
  describe('opening it', () => {
    it('lists the actions of the whole email when nothing is selected', () => {
      const { panel, isOpen } = mount();
      isOpen(true);
      expect(panel.target()).toEqual({ kind: 'email' });
      expect(ids(panel.actions())).toEqual([
        'generate-subject',
        'generate-preheader',
      ]);
      expect(panel.session()).toBeNull();
    });

    it('opens a field’s single action directly, from its icon', () => {
      const { panel, isOpen } = mount();
      panel.openTarget({ kind: 'preheader' });
      expect(isOpen()).toBe(true);
      expect(panel.session().state.action).toBe('generate-preheader');
      expect(panel.sessionAction()).toEqual({
        id: 'generate-preheader',
        canApply: true,
      });
    });

    it('refuses an action its target does not offer', () => {
      const { panel } = mount();
      expect(panel.openAction('generate-subject', { kind: 'preheader' })).toBe(
        false
      );
      expect(panel.session()).toBeNull();
    });
  });

  describe('following the selection', () => {
    it('follows the selected block while it lists', () => {
      const { panel, isOpen, selection } = mount();
      isOpen(true);
      selection(COVER);
      expect(panel.target()).toEqual({
        kind: 'block',
        blockId: 'ko_coverBlock_1',
        blockType: 'coverBlock',
      });
      expect(ids(panel.targetActions())).toEqual(['correct-text']);
      selection(null);
      expect(panel.target()).toEqual({ kind: 'email' });
    });

    it('follows the field being edited, and offers « Corriger » on it', () => {
      const { panel, isOpen, editField } = mount();
      isOpen(true);
      const title = {
        kind: 'blockField',
        blockId: 'ko_coverBlock_1',
        blockType: 'coverBlock',
        field: 'titleText',
      };
      editField(title, COVER);
      expect(panel.target()).toEqual(title);
      expect(ids(panel.targetActions())).toEqual(['correct-text']);
    });

    it('keeps the field it followed when the focus moves to the panel', () => {
      const { panel, isOpen, editField, blur } = mount();
      isOpen(true);
      const title = {
        kind: 'blockField',
        blockId: 'ko_coverBlock_1',
        blockType: 'coverBlock',
        field: 'titleText',
      };
      editField(title, COVER);
      panel.openAction('correct-text', title);
      // « Toutes les actions »: the focus is in the panel now, not in the field.
      blur();
      panel.showList();
      expect(panel.target()).toEqual(title);
    });

    it('offers the preheader’s actions on the block that holds it', () => {
      const { panel, isOpen, selection } = mount();
      isOpen(true);
      selection(PREHEADER_BLOCK);
      expect(ids(panel.targetActions())).toEqual(['generate-preheader']);
    });

    it('keeps the action under way, and says the selection changed only for an element with actions', () => {
      // A block with no action: the definitions without « Corriger ».
      const { panel, selection } = mount({
        definitions: ACTIONS.filter((action) => action.id !== 'correct-text'),
      });
      panel.openAction('generate-subject');
      selection(COVER);
      expect(panel.selectionChanged()).toBeNull();
      selection(PREHEADER_BLOCK);
      expect(panel.selectionChanged()).toEqual({ kind: 'preheader' });
      // A click on the background deselects: nothing new to offer.
      selection(null);
      expect(panel.selectionChanged()).toBeNull();
      expect(panel.session().state.action).toBe('generate-subject');
    });
  });

  describe('an action on a block', () => {
    const rewrite = {
      id: 'rewrite-block',
      family: 'proposals',
      feature: 'textGeneration',
      targets: ['block'],
      describe: () => ({ canApply: true }),
    };

    it('opens on its target, which the session knows', () => {
      const { panel, selection } = mount({
        definitions: [...ACTIONS, rewrite],
      });
      selection(COVER);
      expect(panel.openAction('rewrite-block', panel.target())).toBe(true);
      expect(panel.session().state.action).toBe('rewrite-block');
      expect(panel.session().state.target).toEqual({
        kind: 'block',
        blockId: 'ko_coverBlock_1',
        blockType: 'coverBlock',
      });
    });
  });

  it('refreshes the action under way after each step of the editor undo', () => {
    const { panel, history } = mount();
    panel.openTarget({
      kind: 'blockField',
      blockId: 'ko_coverBlock_1',
      blockType: 'coverBlock',
      field: 'titleText',
    });
    const refresh = jest.fn();
    panel.session().refresh = refresh;
    history(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('lets go of the view model on dispose', () => {
    const { panel, isOpen, selection, history } = mount();
    panel.openTarget({ kind: 'preheader' });
    const refresh = jest.fn();
    panel.session().refresh = refresh;
    panel.dispose();
    history(1);
    expect(refresh).not.toHaveBeenCalled();
    panel.showList();
    isOpen(true);
    selection(COVER);
    expect(panel.target()).toEqual({ kind: 'email' });
  });
});

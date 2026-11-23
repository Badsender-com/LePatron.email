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
const {
  targetOfBlock,
} = require('../../../packages/editor/src/js/ext/ai-panel/targets');

const CONTEXT = {
  textGeneration: true,
  hasSubject: true,
  hasSubjectField: true,
  hasPreheaderField: true,
};

const block = (type, id) => ({ type: () => type, id: () => id });
const COVER = block('coverBlock', 'ko_coverBlock_1');
const PREHEADER_BLOCK = block('preheaderBlock', 'ko_preheaderBlock_1');

const PROPOSALS = {
  proposals: [{ text: 'Les soldes commencent', angle: 'direct', facts: {} }],
};

function mount({
  context = CONTEXT,
  definitions,
  generate = jest.fn().mockResolvedValue(PROPOSALS),
} = {}) {
  const isOpen = ko.observable(false);
  const selection = ko.observable(null);
  const editor = {
    context: () => context,
    mailingId: 'mailing-1',
    emailCopy: () => [{ role: 'title', text: 'Les soldes' }],
    getSubject: () => 'Les soldes',
    knownSubject: () => 'Les soldes',
    getPreheader: () => '',
  };
  const panel = createAiPanel({
    ko,
    editor,
    api: { generate },
    isOpen,
    selection,
    definitions,
  });
  return { panel, isOpen, selection };
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
      expect(panel.targetActions()).toEqual([]);
      selection(null);
      expect(panel.target()).toEqual({ kind: 'email' });
    });

    it('offers the preheader’s actions on the block that holds it', () => {
      const { panel, isOpen, selection } = mount();
      isOpen(true);
      selection(PREHEADER_BLOCK);
      expect(ids(panel.targetActions())).toEqual(['generate-preheader']);
    });

    it('keeps the action under way, and says the selection changed only for an element with actions', () => {
      const { panel, selection } = mount();
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

  describe('coming back to an action', () => {
    it('finds the action under way as it was when its icon is clicked again', async () => {
      const { panel, isOpen } = mount();
      panel.openTarget({ kind: 'subject' });
      const opened = panel.session();
      await opened.request({ brief: 'Ton enjoué' });
      isOpen(false);
      const notified = jest.fn();
      panel.session.subscribe(notified);
      panel.openTarget({ kind: 'subject' });
      expect(isOpen()).toBe(true);
      // The same steps, not drawn again: nothing tells the panel to start over.
      expect(notified).not.toHaveBeenCalled();
      expect(panel.session()).toBe(opened);
      expect(opened.state.brief).toBe('Ton enjoué');
      expect(opened.state.proposals).toHaveLength(1);
    });

    it('finds the same action from the list as from the field’s icon', () => {
      const { panel } = mount();
      panel.openTarget({ kind: 'subject' });
      const opened = panel.session();
      panel.showList();
      panel.openAction('generate-subject');
      expect(panel.session()).toBe(opened);
    });

    it('keeps the last session of each action, and the list keeps them all', async () => {
      const { panel } = mount();
      panel.openAction('generate-subject');
      const subject = panel.session();
      await subject.request({ brief: 'Court' });
      panel.openAction('generate-preheader');
      const preheader = panel.session();
      expect(preheader).not.toBe(subject);
      panel.showList();
      expect(panel.session()).toBeNull();
      panel.openAction('generate-subject');
      expect(panel.session()).toBe(subject);
      expect(subject.state.proposals).toHaveLength(1);
      panel.openAction('generate-preheader');
      expect(panel.session()).toBe(preheader);
    });

    it('keeps the proposals when the user goes to see the actions of the element selected since', async () => {
      const { panel, selection } = mount();
      panel.openAction('generate-subject');
      const subject = panel.session();
      await subject.request();
      selection(PREHEADER_BLOCK);
      panel.showList(panel.selectionChanged());
      expect(ids(panel.targetActions())).toEqual(['generate-preheader']);
      panel.openAction('generate-subject');
      expect(panel.session()).toBe(subject);
      expect(subject.state.proposals).toHaveLength(1);
    });

    it('lets a request left under way end in its own session, not the one shown', async () => {
      let answer;
      const generate = jest.fn(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          })
      );
      const { panel } = mount({ generate });
      panel.openAction('generate-subject');
      const subject = panel.session();
      const asked = subject.request();
      panel.openAction('generate-preheader');
      const preheader = panel.session();
      answer(PROPOSALS);
      await asked;
      expect(panel.session()).toBe(preheader);
      expect(preheader.state.proposals).toEqual([]);
      panel.openAction('generate-subject');
      expect(panel.session()).toBe(subject);
      expect(subject.state.isLoading).toBe(false);
      expect(subject.state.proposals).toHaveLength(1);
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
      panel.openTarget(panel.target());
      expect(panel.session().state.action).toBe('rewrite-block');
      expect(panel.session().state.target).toEqual({
        kind: 'block',
        blockId: 'ko_coverBlock_1',
        blockType: 'coverBlock',
      });
    });

    it('starts afresh on another block, which is other work', () => {
      const { panel, selection } = mount({
        definitions: [...ACTIONS, rewrite],
      });
      selection(COVER);
      panel.openTarget(panel.target());
      const onCover = panel.session();
      panel.showList(targetOfBlock(block('textBlock', 'ko_textBlock_2')));
      panel.openTarget(panel.target());
      expect(panel.session()).not.toBe(onCover);
      expect(panel.session().state.target.blockId).toBe('ko_textBlock_2');
    });
  });

  it('lets go of the view model on dispose', () => {
    const { panel, isOpen, selection } = mount();
    panel.dispose();
    isOpen(true);
    selection(COVER);
    expect(panel.target()).toEqual({ kind: 'email' });
  });
});

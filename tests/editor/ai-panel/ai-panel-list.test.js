/**
 * @jest-environment jsdom
 */

'use strict';

// The list of the AI panel (ADR 0020, boards a1, a2): each action says what
// it is on, the finest selection's first and set forth.

const ko = require('knockout');
const Vue = require('vue/dist/vue.common');
const {
  AiPanel,
} = require('../../../packages/editor/src/js/vue/components/ai-panel/ai-panel.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

function mount(
  target,
  targetActions = [],
  actions = [
    { id: 'generate-subject', canApply: true },
    { id: 'correct-text', canApply: true },
  ],
  { blockActions = [], blockFieldCount = null } = {}
) {
  const panel = {
    target: ko.observable(target),
    actions: ko.observable(actions),
    targetActions: ko.observable(targetActions),
    blockActions: ko.observable(blockActions),
    blockFieldCount: ko.observable(blockFieldCount),
    blockOf: (on) => ({ kind: 'block', blockId: on.blockId }),
    session: ko.observable(null),
    sessionAction: ko.observable(null),
    selectionChanged: ko.observable(null),
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  const vm = {
    t: (key) => key,
    commentBlockLabel: () => 'Cover · bloc 2',
  };
  return new Vue({
    components: { AiPanel },
    data: () => ({ vm, panel }),
    template: '<ai-panel :vm="vm" :panel="panel"></ai-panel>',
  }).$mount(el).$el;
}

const names = (root) =>
  [...root.querySelectorAll('.ai-panel__action-name')].map(
    (n) => n.textContent
  );

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the list of the AI panel', () => {
  it('invites to select, and names the whole email’s actions (board a1)', () => {
    const root = mount({ kind: 'email' });
    expect(root.querySelector('.ai-panel__invite').textContent).toContain(
      'ai-panel-select-invite'
    );
    expect(names(root)).toEqual([
      'ai-panel-action-subject',
      'ai-panel-correct-email',
    ]);
    expect(root.querySelector('.ai-panel__note')).not.toBeNull();
  });

  it('names an action on its target, the finest first and set forth (board a2)', () => {
    const root = mount(
      { kind: 'blockField', blockId: 'b1', field: 'titleText' },
      [{ id: 'correct-text', canApply: true }]
    );
    expect(root.querySelector('.ai-panel__invite')).toBeNull();
    // The field by what it is: « Champ sélectionné · Titre ».
    expect(root.querySelector('.ai-panel__section').textContent).toContain(
      'ai-panel-field-title'
    );
    expect(names(root)[0]).toBe('ai-panel-correct-field');
    expect(
      root.querySelector('.ai-panel__action--first .ai-panel__action-desc')
        .textContent
    ).toBe('ai-panel-correct-field-desc');
  });

  it('lists the block of a selected field, its actions counting its fields (board a2)', () => {
    const root = mount(
      { kind: 'blockField', blockId: 'b1', field: 'titleText' },
      [{ id: 'correct-text', canApply: true }],
      undefined,
      {
        blockActions: [{ id: 'correct-text', canApply: true }],
        blockFieldCount: 4,
      }
    );
    const sections = [...root.querySelectorAll('.ai-panel__section')].map(
      (section) => section.textContent
    );
    expect(sections[1]).toContain('ai-panel-selected-block');
    expect(sections[1]).toContain('Cover · bloc 2');
    expect(names(root).slice(0, 2)).toEqual([
      'ai-panel-correct-field',
      'ai-panel-correct-block',
    ]);
    expect(root.querySelectorAll('.ai-panel__action-desc')[1].textContent).toBe(
      'ai-panel-correct-block-desc-count'
    );
  });

  it('lists no block section for a selected block, nor for a field whose block offers nothing', () => {
    const block = mount({ kind: 'block', blockId: 'b1' }, [
      { id: 'correct-text', canApply: true },
    ]);
    expect(block.querySelectorAll('.ai-panel__section')).toHaveLength(2);
    const field = mount(
      { kind: 'blockField', blockId: 'b1', field: 'titleText' },
      [{ id: 'correct-text', canApply: true }]
    );
    expect(field.querySelectorAll('.ai-panel__section')).toHaveLength(2);
  });

  it('names the whole email’s actions alone under a selection, a copy-only one still saying so (board a2)', () => {
    const descs = (root) =>
      [...root.querySelectorAll('.ai-panel__action')].map((a) => {
        const desc = a.querySelector('.ai-panel__action-desc');
        return desc && desc.textContent;
      });
    expect(descs(mount({ kind: 'email' }))).toEqual([
      'ai-panel-subject-desc',
      'ai-panel-correct-email-desc',
    ]);
    const root = mount(
      { kind: 'block', blockId: 'b1' },
      [{ id: 'correct-text', canApply: true }],
      [
        { id: 'generate-subject', canApply: false },
        { id: 'correct-text', canApply: true },
      ]
    );
    // The block's action, then the email's two by their name, but for the
    // one that can only be copied.
    expect(descs(root)).toEqual([
      'ai-panel-correct-block-desc',
      'ai-panel-copy-only',
      null,
    ]);
  });

  it('names a block’s action « Corriger ce bloc », and a subject or preheader as a field', () => {
    const block = mount({ kind: 'block', blockId: 'b1' }, [
      { id: 'correct-text', canApply: true },
    ]);
    expect(names(block)[0]).toBe('ai-panel-correct-block');
    expect(block.querySelector('h3.ai-panel__section').textContent).toContain(
      'ai-panel-selected-block'
    );
    const preheader = mount({ kind: 'preheader' }, [
      { id: 'generate-preheader', canApply: true },
    ]);
    expect(
      preheader.querySelector('h3.ai-panel__section').textContent
    ).toContain('ai-panel-selected-field');
  });
});

describe('Escape in the AI panel', () => {
  const { onEscape } = AiPanel.options.methods;
  const keydown = () => ({
    defaultPrevented: false,
    stopPropagation: jest.fn(),
  });

  it('steps back from an action to the list, the panel staying open', () => {
    const self = { session: { state: {} }, showList: jest.fn() };
    const event = keydown();
    onEscape.call(self, event);
    expect(self.showList).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('lets the panel close from the list, and leaves an Escape already handled', () => {
    const list = { session: null, showList: jest.fn() };
    const event = keydown();
    onEscape.call(list, event);
    expect(event.stopPropagation).not.toHaveBeenCalled();

    const handled = { session: { state: {} }, showList: jest.fn() };
    onEscape.call(handled, { ...keydown(), defaultPrevented: true });
    expect(handled.showList).not.toHaveBeenCalled();
  });
});

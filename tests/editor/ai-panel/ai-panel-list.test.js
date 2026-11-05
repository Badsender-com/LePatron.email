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

function mount(target, targetActions = []) {
  const panel = {
    target: ko.observable(target),
    actions: ko.observable([
      { id: 'generate-subject', canApply: true },
      { id: 'correct-text', canApply: true },
    ]),
    targetActions: ko.observable(targetActions),
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
    expect(root.querySelector('.ai-panel__section').textContent).toContain(
      'Cover · bloc 2'
    );
    expect(names(root)[0]).toBe('ai-panel-correct-field');
    expect(
      root.querySelector('.ai-panel__action--first .ai-panel__action-desc')
        .textContent
    ).toBe('ai-panel-correct-field-desc');
  });
});

/**
 * @jest-environment jsdom
 */

'use strict';

// The AI panel renders what its controller holds (ADR 0020): it mirrors the
// controller's observables, and a session that changes starts its steps
// afresh, at each notification, never at mount.

const ko = require('knockout');
const Vue = require('vue/dist/vue.common');
const {
  AiPanel,
} = require('../../../packages/editor/src/js/vue/components/ai-panel/ai-panel.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

// The steps of an action are their own components, tested apart.
const Panel = AiPanel.extend({
  components: {
    AiProposalsSteps: { template: '<div></div>' },
    AiCorrectionsSteps: { template: '<div></div>' },
  },
});

const SESSION = { state: { action: 'generate-subject' } };

function fakePanel() {
  return {
    target: ko.observable({ kind: 'email' }),
    actions: ko.observable([]),
    targetActions: ko.observable([]),
    session: ko.observable(null),
    sessionAction: ko.observable({ id: 'generate-subject', canApply: true }),
    selectionChanged: ko.observable(null),
  };
}

function mount(panel) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const vm = { t: (key) => key, showAi: ko.observable(true) };
  return new Vue({
    components: { Panel },
    data: () => ({ vm, panel }),
    template: '<panel :vm="vm" :panel="panel"></panel>',
  }).$mount(el).$children[0];
}

describe('the AI panel and its controller', () => {
  it('reads what the controller holds, then follows it', () => {
    const panel = fakePanel();
    const component = mount(panel);
    expect(component.target).toEqual({ kind: 'email' });
    panel.selectionChanged({ kind: 'preheader' });
    expect(component.selectionChanged).toEqual({ kind: 'preheader' });
    component.$root.$destroy();
  });

  it('starts the steps afresh at each change of the session, not at mount', () => {
    const panel = fakePanel();
    const session = SESSION;
    panel.session(session);
    const component = mount(panel);
    expect(component.sessionKey).toBe(0);
    component.liveMessage = 'Copied';
    panel.session(session);
    expect(component.sessionKey).toBe(1);
    expect(component.liveMessage).toBe('');
    component.$root.$destroy();
  });

  it('gives the focus to the heading when the session changes', async () => {
    const panel = fakePanel();
    const component = mount(panel);
    panel.session(SESSION);
    await component.$nextTick();
    await component.$nextTick();
    expect(document.activeElement).toBe(component.$refs.heading);
    component.$root.$destroy();
  });

  it('lets go of the controller when destroyed', () => {
    const panel = fakePanel();
    const component = mount(panel);
    component.$root.$destroy();
    expect(panel.session.getSubscriptionsCount()).toBe(0);
    expect(panel.target.getSubscriptionsCount()).toBe(0);
  });
});

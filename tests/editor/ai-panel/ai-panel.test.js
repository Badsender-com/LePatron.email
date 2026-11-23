/**
 * @jest-environment jsdom
 */
'use strict';

/**
 * The « Outils IA » panel as the user meets it (ADR 0010): its lists of
 * actions, an action found again as it was left, what it says to screen
 * readers, and the AI icons it places on the fields. Its decisions are the
 * controller's (ai-panel-controller.test.js); this renders them.
 */

const Vue = require('vue/dist/vue.common');
const ko = require('knockout');
const {
  createAiPanel,
} = require('../../../packages/editor/src/js/ext/ai-panel/ai-panel-controller');
const {
  AiPanel,
} = require('../../../packages/editor/src/js/vue/components/ai-panel/ai-panel');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const CONTEXT = {
  textGeneration: true,
  hasSubject: true,
  hasSubjectField: true,
  hasPreheaderField: true,
};
const PROPOSALS = {
  proposals: [{ text: 'Les soldes commencent', angle: 'direct', facts: {} }],
};

const SUBJECT_FIELD = `
  <div class="email-metadata__label-row"><label for="email-metadata-subject">Objet</label></div>
  <input id="email-metadata-subject" type="text">`;

let app;

function mount({ context = CONTEXT, generate } = {}) {
  document.body.innerHTML = `
    <div id="toolcontents">${SUBJECT_FIELD}</div>
    <div id="elsewhere">${SUBJECT_FIELD.replace(
      /email-metadata-subject/g,
      'other'
    )}</div>
    <div id="toolai"><div id="ai-panel"></div></div>
    <button id="outside">Ailleurs</button>`;
  const isOpen = ko.observable(false);
  const selection = ko.observable(null);
  const panel = createAiPanel({
    ko,
    editor: {
      context: () => context,
      mailingId: 'mailing-1',
      emailCopy: () => [{ role: 'title', text: 'Les soldes' }],
      getSubject: () => 'Les soldes',
      knownSubject: () => 'Les soldes',
      getPreheader: () => '',
    },
    api: { generate: generate || jest.fn().mockResolvedValue(PROPOSALS) },
    isOpen,
    selection,
  });
  const vm = { t: (key) => key, showAi: isOpen };
  app = new Vue({
    render: (h) => h(AiPanel, { props: { vm, panel } }),
  }).$mount('#ai-panel');
  return { panel, isOpen, selection, root: app.$el };
}

afterEach(() => {
  if (app) app.$destroy();
  app = null;
  jest.useRealTimers();
});

const subjectIcon = () =>
  document.querySelector('#toolcontents [data-ai-target="subject"]');

describe('ai panel: the panel', () => {
  describe('the AI icons on the fields', () => {
    it('places them where the fields live, not in the panels beside them', () => {
      mount();
      expect(subjectIcon()).not.toBeNull();
      expect(document.querySelector('#elsewhere [data-ai-target]')).toBeNull();
    });

    it('places nothing once the panel is gone, even a change seen just before', async () => {
      jest.useFakeTimers();
      mount();
      subjectIcon().remove();
      // The observer sees the change, then the panel goes.
      await Promise.resolve();
      app.$destroy();
      app = null;
      jest.runAllTimers();
      expect(subjectIcon()).toBeNull();
    });
  });
});

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
const PREHEADER_BLOCK = {
  type: () => 'preheaderBlock',
  id: () => 'ko_preheaderBlock_1',
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

const flush = async () => {
  await Promise.resolve();
  await Vue.nextTick();
};
const liveRegion = (root) => root.querySelector('[aria-live]');
const heading = (root) => root.querySelector('#ai-panel-title');
const subjectIcon = () =>
  document.querySelector('#toolcontents [data-ai-target="subject"]');

describe('ai panel: the panel', () => {
  describe('its lists', () => {
    it('heads each list, which its heading labels', async () => {
      const { selection, isOpen, root } = mount();
      isOpen(true);
      selection(PREHEADER_BLOCK);
      await flush();
      const lists = [...root.querySelectorAll('ul.ai-panel__actions')];
      expect(lists).toHaveLength(2);
      lists.forEach((list) => {
        const title = document.getElementById(
          list.getAttribute('aria-labelledby')
        );
        expect(title.tagName).toBe('H3');
      });
      expect(
        lists.map(
          (list) =>
            document.getElementById(list.getAttribute('aria-labelledby'))
              .textContent
        )
      ).toEqual(['ai-panel-selected-block', 'ai-panel-whole-email']);
    });

    it('says an action can only be copied, in the selected element’s list too', async () => {
      const { selection, isOpen, root } = mount({
        context: { ...CONTEXT, hasPreheaderField: false },
      });
      isOpen(true);
      selection(PREHEADER_BLOCK);
      await flush();
      const [selected] = root.querySelectorAll('ul.ai-panel__actions');
      expect(selected.textContent).toContain('ai-panel-copy-only');
    });

    it('names its close button with a translated label', () => {
      const { root } = mount();
      const close = root.querySelector('.right-panel__header button');
      expect(close.getAttribute('aria-label')).toBe('quality-action-close');
    });
  });

  describe('coming back to an action', () => {
    it('finds the action as it was, and takes the focus, when its icon is clicked again', async () => {
      const { isOpen, root } = mount();
      subjectIcon().click();
      await flush();
      const brief = root.querySelector('#ai-panel-brief');
      brief.value = 'Ton enjoué';
      brief.dispatchEvent(new Event('input'));
      root.querySelector('.ai-panel__start').click();
      await flush();
      await flush();
      isOpen(false);
      document.getElementById('outside').focus();
      subjectIcon().click();
      await flush();
      expect(isOpen()).toBe(true);
      expect(document.activeElement).toBe(heading(root));
      expect(root.querySelector('#ai-panel-brief').value).toBe('Ton enjoué');
      expect(root.querySelectorAll('.ai-panel__proposal')).toHaveLength(1);
    });

    it('draws the instruction last sent when the user comes back from another action', async () => {
      const { panel, root } = mount();
      panel.openAction('generate-subject');
      await flush();
      const brief = root.querySelector('#ai-panel-brief');
      brief.value = 'Court';
      brief.dispatchEvent(new Event('input'));
      root.querySelector('.ai-panel__start').click();
      await flush();
      panel.openAction('generate-preheader');
      await flush();
      panel.openAction('generate-subject');
      await flush();
      expect(root.querySelector('#ai-panel-brief').value).toBe('Court');
    });

    it('announces nothing, and moves no focus, for a request ending in an action no longer shown', async () => {
      let answer;
      const generate = jest.fn(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          })
      );
      const { panel, root } = mount({ generate });
      panel.openAction('generate-subject');
      await flush();
      root.querySelector('.ai-panel__start').click();
      panel.openAction('generate-preheader');
      await flush();
      const focused = document.activeElement;
      answer(PROPOSALS);
      await flush();
      await flush();
      expect(liveRegion(root).textContent).not.toContain('ai-panel-proposed');
      expect(document.activeElement).toBe(focused);
    });
  });

  it('says the selection changed as its notice appears', async () => {
    const { panel, selection, root } = mount();
    panel.openAction('generate-subject');
    selection(PREHEADER_BLOCK);
    await flush();
    expect(root.querySelector('.ai-panel__moved')).not.toBeNull();
    expect(liveRegion(root).textContent).toBe('ai-panel-selection-changed');
  });

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

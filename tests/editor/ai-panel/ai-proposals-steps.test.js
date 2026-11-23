/**
 * @jest-environment jsdom
 */
'use strict';

/**
 * The steps of a "proposals" action as the user sees them: the facts read
 * with each proposal, what is said when a request brings nothing new, and
 * what is announced to screen readers (ADR 0010, ADR 0016).
 */

const Vue = require('vue/dist/vue.common');
const en = require('../../../public/lang/badsender-en.js');
const {
  AiProposalsSteps,
} = require('../../../packages/editor/src/js/vue/components/ai-panel/ai-proposals-steps');
const {
  createActionSession,
} = require('../../../packages/editor/src/js/ext/ai-panel/action-session');
const {
  definitionOf,
} = require('../../../packages/editor/src/js/ext/ai-panel/actions');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const t = (key, params = {}) =>
  Object.entries(params).reduce(
    (text, [name, value]) => text.split(`__${name}__`).join(value),
    en[key] === undefined ? key : en[key]
  );

function fakeEditor() {
  return {
    mailingId: 'm1',
    emailCopy: () => [{ role: 'title', text: 'Les soldes commencent' }],
    canApplySubject: true,
    canApplyPreheader: true,
    getSubject: () => 'Objet',
    knownSubject: () => 'Objet',
    rememberSubject: () => {},
    setSubject: () => {},
    getPreheader: () => '',
    setPreheader: () => {},
    startMultiple: () => {},
    stopMultiple: () => {},
  };
}

const preheader = (text, facts) => ({
  text,
  angle: 'Angle',
  facts: { length: text.length, long: false, tooLong: false, ...facts },
});

const answer = (proposals, counts = {}) => ({
  proposals,
  dropped: 0,
  repeated: 0,
  ...counts,
});

describe('ai panel: the steps of a proposals action, rendered', () => {
  let api;
  let steps;
  let announced;

  function mount() {
    const session = createActionSession({
      action: 'generate-preheader',
      api,
      editor: fakeEditor(),
    });
    // As the panel does, holding the session in its reactive data.
    Vue.observable(session.state);
    announced = [];
    steps = new AiProposalsSteps({
      propsData: {
        vm: { t },
        session,
        action: { canApply: true },
        labelsOf: (id) => definitionOf(id).labels,
      },
    }).$mount();
    document.body.appendChild(steps.$el);
    steps.$on('announce', (message) => announced.push(message));
    return steps;
  }

  const text = () => steps.$el.textContent;
  const button = (label) =>
    Array.from(steps.$el.querySelectorAll('button')).find(
      (element) => element.textContent.trim() === label
    );

  beforeEach(() => {
    api = { generate: jest.fn() };
  });

  afterEach(() => {
    steps.$destroy();
    document.body.innerHTML = '';
  });

  // The preheader follows the subject only where the registry offers it: its
  // skill may not run for the company while the subject's does.
  describe('the action that follows', () => {
    async function applySubject(action) {
      const session = createActionSession({
        action: 'generate-subject',
        api,
        editor: fakeEditor(),
      });
      Vue.observable(session.state);
      steps = new AiProposalsSteps({
        propsData: {
          vm: { t },
          session,
          action,
          labelsOf: (id) => definitionOf(id).labels,
        },
      }).$mount();
      api.generate.mockResolvedValue(answer([preheader('Les soldes')]));
      await session.request({});
      session.select(0);
      session.apply();
      await Vue.nextTick();
    }
    const continueLabel = en['ai-panel-next-preheader'];

    it('is offered once the subject is applied, when the registry offers it', async () => {
      await applySubject({ canApply: true, next: 'generate-preheader' });
      expect(button(continueLabel)).toBeTruthy();
    });

    it('is not offered when the registry does not', async () => {
      await applySubject({ canApply: true });
      expect(text()).toContain(en['text-generation-applied']);
      expect(button(continueLabel)).toBeUndefined();
    });
  });

  describe('the facts of a preheader', () => {
    it('says "long" past the recommended length, as quality control will', async () => {
      api.generate.mockResolvedValue(
        answer([preheader('x'.repeat(120), { long: true })])
      );
      mount();
      await steps.generate();
      await Vue.nextTick();
      expect(text()).toContain(en['text-generation-long']);
      expect(text()).not.toContain(en['text-generation-too-long']);
    });

    it('says "too long", and only that, past the maximum', async () => {
      api.generate.mockResolvedValue(
        answer([preheader('x'.repeat(150), { long: true, tooLong: true })])
      );
      mount();
      await steps.generate();
      await Vue.nextTick();
      expect(text()).toContain(en['text-generation-too-long']);
      expect(text()).not.toContain(en['text-generation-long']);
    });

    it('says nothing of the length within the recommended one', async () => {
      api.generate.mockResolvedValue(answer([preheader('Court')]));
      mount();
      await steps.generate();
      await Vue.nextTick();
      expect(steps.$el.querySelectorAll('.ai-panel__facts li')).toHaveLength(1);
    });
  });

  describe('asking for others', () => {
    it('announces the new proposals, in the singular for one, and moves the focus to them', async () => {
      api.generate.mockResolvedValue(answer([preheader('P1')]));
      mount();
      await steps.generate();
      await Vue.nextTick();
      expect(announced).toContain('1 proposal');
      expect(document.activeElement).toBe(steps.$refs.proposals);
    });

    it('says the others were all set aside, keeps the proposals shown and leaves the focus where it is', async () => {
      api.generate
        .mockResolvedValueOnce(answer([preheader('P1'), preheader('P2')]))
        .mockResolvedValueOnce(answer([], { repeated: 2, dropped: 1 }));
      mount();
      await steps.generate();
      await Vue.nextTick();
      const more = button(en['text-generation-more']);
      more.focus();
      announced = [];

      await steps.more();
      await Vue.nextTick();

      const notice = steps.$el.querySelector('.ai-panel__nothing-new');
      expect(notice.textContent).toContain(en['text-generation-nothing-new']);
      // Above the proposals kept.
      expect(
        notice.compareDocumentPosition(steps.$refs.proposals) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(text()).toContain('P1');
      expect(text()).toContain(t('text-generation-repeated', { count: 2 }));
      expect(text()).toContain(t('text-generation-dropped', { count: 1 }));
      expect(announced).toEqual([
        en['ai-panel-loading'],
        en['text-generation-nothing-new'],
      ]);
      expect(document.activeElement).toBe(more);
    });

    it('says how many were set aside as already made, along with the new ones', async () => {
      api.generate
        .mockResolvedValueOnce(answer([preheader('P1')]))
        .mockResolvedValueOnce(answer([preheader('P2')], { repeated: 2 }));
      mount();
      await steps.generate();
      await steps.more();
      await Vue.nextTick();
      expect(text()).toContain(t('text-generation-repeated', { count: 2 }));
      expect(steps.$el.querySelector('.ai-panel__nothing-new')).toBeNull();
      expect(text()).toContain('P2');
    });

    it('says no proposal came when the first request brings none', async () => {
      api.generate.mockResolvedValue(answer([], { dropped: 3 }));
      mount();
      await steps.generate();
      await Vue.nextTick();
      expect(text()).toContain(en['text-generation-none']);
      expect(announced).toContain(en['text-generation-none']);
    });
  });
});

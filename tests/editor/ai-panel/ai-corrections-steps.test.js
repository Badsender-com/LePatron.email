/**
 * @jest-environment jsdom
 */
'use strict';

/**
 * The steps of a "corrections" action as the user sees them (ADR 0011): an
 * analysis made is not asked again when the panel shows it again, what an
 * analysis that found nothing says, the pause, and the rewrites, which
 * « Tout accepter » leaves to be accepted one by one.
 */

const Vue = require('vue/dist/vue.common');
const en = require('../../../public/lang/badsender-en.js');
const fr = require('../../../public/lang/badsender-fr.js');
const {
  AiCorrectionsSteps,
} = require('../../../packages/editor/src/js/vue/components/ai-panel/ai-corrections-steps');
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

const EMAIL = { kind: 'email' };
const FIELD = {
  kind: 'blockField',
  blockId: 'ko_textBlock_1',
  blockType: 'textBlock',
  field: 'titleText',
};

const correction = (id, extra = {}) => ({
  id,
  blockId: 'ko_textBlock_1',
  field: 'titleText',
  role: 'title',
  before: `avant ${id}`,
  after: `après ${id}`,
  reason: 'Orthographe',
  status: 'pending',
  ...extra,
});

// A session as the corrections session exposes it, its state as given.
function fakeSession(state = {}) {
  return {
    state: {
      action: 'correct-text',
      target: EMAIL,
      isLoading: false,
      error: null,
      corrections: [],
      done: false,
      dropped: 0,
      leftOut: null,
      tooLong: 0,
      nothingToCorrect: false,
      progress: null,
      pausedFor: null,
      resumesAt: null,
      failedBlocks: [],
      stopped: false,
      canResume: false,
      unchecked: 0,
      ...state,
    },
    request: jest.fn().mockResolvedValue(),
    restart: jest.fn().mockResolvedValue(),
    resume: jest.fn().mockResolvedValue(),
    stop: jest.fn(),
    accept: jest.fn(() => ({ accepted: 1, stale: 0 })),
    acceptAll: jest.fn(() => ({ accepted: 0, stale: 0 })),
    acceptBlock: jest.fn(() => ({ accepted: 0, stale: 0 })),
    ignore: jest.fn(),
    blockLabel: (blockId) => `Block ${blockId}`,
    canGoToBlock: () => true,
    goToBlock: jest.fn(),
    undo: jest.fn(),
    redo: jest.fn(),
  };
}

// One field to correct, as the editor gives it.
function fakeEditor() {
  const html = { titleText: '<p>Les soldes commence demain</p>' };
  return {
    mailingId: 'm1',
    textFieldsOf: () => [
      {
        path: 'titleText',
        role: 'title',
        html: html.titleText,
        hidden: false,
        atDefault: false,
      },
    ],
    readField: (_blockId, path) => html[path],
    writeField: (_blockId, path, value) => {
      html[path] = value;
    },
    startMultiple: () => {},
    stopMultiple: () => {},
  };
}

describe('ai panel: the steps of a corrections action, rendered', () => {
  let steps;
  let announced;

  function mount(session) {
    // As the panel does, holding the session in its reactive data.
    Vue.observable(session.state);
    announced = [];
    steps = new AiCorrectionsSteps({
      propsData: {
        vm: { t },
        session,
        action: { canApply: true },
        labelsOf: (id) => definitionOf(id).labels,
      },
    });
    steps.$on('announce', (message) => announced.push(message));
    steps.$mount();
    document.body.appendChild(steps.$el);
    return steps;
  }

  // The panel draws the steps again: a new component on the same session.
  function remount(session) {
    steps.$destroy();
    document.body.innerHTML = '';
    return mount(session);
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve));
  const text = () => steps.$el.textContent;
  const button = (label) =>
    Array.from(steps.$el.querySelectorAll('button')).find(
      (element) => element.textContent.trim() === label
    );

  afterEach(() => {
    jest.useRealTimers();
    if (steps) steps.$destroy();
    steps = null;
    document.body.innerHTML = '';
  });

  describe('coming back to it', () => {
    it('analyses the first time only: shown again, a finished analysis asks nothing', async () => {
      const api = {
        generate: jest.fn().mockResolvedValue({
          corrections: [
            {
              field: 'titleText',
              before: 'soldes commence',
              after: 'soldes commencent',
              reason: 'Accord',
            },
          ],
          dropped: 0,
        }),
      };
      const session = createActionSession({
        action: 'correct-text',
        target: FIELD,
        api,
        editor: fakeEditor(),
      });
      mount(session);
      await flush();
      expect(api.generate).toHaveBeenCalledTimes(1);

      remount(session);
      await flush();
      expect(api.generate).toHaveBeenCalledTimes(1);
      expect(session.state.corrections).toHaveLength(1);
      expect(text()).toContain('soldes commencent');
    });

    it('asks again with « Check again » once an analysis is finished', async () => {
      const session = fakeSession({
        done: true,
        corrections: [correction(1)],
      });
      mount(session);
      await Vue.nextTick();
      expect(session.request).not.toHaveBeenCalled();
      button(en['ai-panel-correction-restart']).click();
      expect(session.restart).toHaveBeenCalledTimes(1);
      expect(session.resume).not.toHaveBeenCalled();
    });

    it('goes on with « Resume » an analysis of the email stopped before its end', async () => {
      const session = fakeSession({
        done: true,
        stopped: true,
        canResume: true,
        progress: { done: 0, total: 12 },
      });
      mount(session);
      await Vue.nextTick();
      expect(session.request).not.toHaveBeenCalled();
      expect(text()).toContain('Check stopped after 0 blocks of 12.');
      button(en['ai-panel-correction-resume']).click();
      expect(session.resume).toHaveBeenCalledTimes(1);
      expect(session.restart).not.toHaveBeenCalled();
    });

    it('offers neither button to a session that cannot', async () => {
      const session = fakeSession({ done: true, corrections: [correction(1)] });
      delete session.restart;
      delete session.resume;
      mount(session);
      await Vue.nextTick();
      expect(button(en['ai-panel-correction-restart'])).toBeUndefined();
      expect(button(en['ai-panel-correction-resume'])).toBeUndefined();
    });

    it('does not say the analysis stopped once every block was done', async () => {
      const session = fakeSession({
        done: true,
        stopped: true,
        progress: { done: 12, total: 12 },
      });
      mount(session);
      await Vue.nextTick();
      expect(text()).not.toContain('Check stopped');
      expect(text()).toContain(en['ai-panel-no-correction']);
    });
  });

  describe('an analysis that found nothing', () => {
    async function ended(state) {
      const session = fakeSession({ isLoading: true, progress: null });
      mount(session);
      Object.assign(session.state, { isLoading: false, done: true, ...state });
      await Vue.nextTick();
      return session;
    }

    it('says there is no text to check, aloud as on screen', async () => {
      await ended({ target: FIELD, nothingToCorrect: true });
      expect(text()).toContain(en['ai-panel-nothing-to-correct']);
      expect(announced).toContain(en['ai-panel-nothing-to-correct']);
      expect(announced).not.toContain(en['ai-panel-no-correction']);
    });

    it('says nothing could be checked when the fields were too long', async () => {
      await ended({ target: FIELD, nothingToCorrect: true, tooLong: 2 });
      expect(text()).toContain(en['ai-panel-nothing-checked']);
      expect(text()).not.toContain(en['ai-panel-nothing-to-correct']);
    });

    it('says no correction applies when some were set aside', async () => {
      await ended({ target: FIELD, dropped: 1 });
      expect(text()).toContain(en['ai-panel-no-applicable-correction']);
      expect(text()).not.toContain(en['ai-panel-no-correction']);
    });

    it('says a part was not checked', async () => {
      await ended({ target: FIELD, unchecked: 2 });
      expect(text()).toContain(en['ai-panel-no-correction-in-checked']);
      expect(text()).toContain('2 fields could not be checked.');
      expect(announced.join(' ')).toContain('2 fields could not be checked.');
    });

    it('does not say no mistake was found when the panel closed on a block under analysis', async () => {
      await ended({ target: FIELD, stopped: true });
      expect(text()).toContain(en['ai-panel-no-correction-in-checked']);
    });

    it('says no mistake was found when everything was checked', async () => {
      await ended({ target: FIELD });
      expect(text()).toContain(en['ai-panel-no-correction']);
    });
  });

  describe('the end of the analysis of the email', () => {
    it('is announced, and moves the focus only from « Stop », which is gone', async () => {
      const session = fakeSession({
        isLoading: true,
        progress: { done: 1, total: 3 },
      });
      mount(session);
      await Vue.nextTick();
      steps.$refs.stop.focus();
      session.state.corrections = [correction(1)];
      Object.assign(session.state, {
        isLoading: false,
        done: true,
        progress: { done: 3, total: 3 },
      });
      await Vue.nextTick();
      await Vue.nextTick();
      expect(announced).toContain('Check done: 1 correction to review.');
      expect(document.activeElement).toBe(steps.$refs.summary);
    });

    it('leaves the focus where the user went meanwhile', async () => {
      const session = fakeSession({
        isLoading: true,
        progress: { done: 1, total: 3 },
        corrections: [correction(1), correction(2)],
      });
      mount(session);
      await Vue.nextTick();
      const accept = steps.$refs['accept-2'][0];
      accept.focus();
      Object.assign(session.state, { isLoading: false, done: true });
      await Vue.nextTick();
      await Vue.nextTick();
      expect(document.activeElement).toBe(accept);
    });
  });

  it('counts down a pause on the rate limit to the hour it ends', async () => {
    jest.useFakeTimers();
    const now = Date.now();
    jest.setSystemTime(now);
    const session = fakeSession({
      isLoading: true,
      progress: { done: 1, total: 3 },
    });
    mount(session);
    Object.assign(session.state, {
      pausedFor: 30,
      resumesAt: new Date(now + 30000),
    });
    await Vue.nextTick();
    expect(text()).toContain('resuming in 30 s');
    jest.advanceTimersByTime(10000);
    await Vue.nextTick();
    expect(text()).toContain('resuming in 20 s');
    expect(announced).toEqual([
      t('ai-panel-correction-paused', { seconds: 30 }),
    ]);
  });

  it('names its block for « Go to block » and « Accept all in this block »', async () => {
    const session = fakeSession({
      done: true,
      corrections: [correction(1), correction(2)],
    });
    mount(session);
    await Vue.nextTick();
    const heading = steps.$el.querySelector('h3');
    expect(heading.id).toBe('ai-panel-group-ko_textBlock_1');
    [en['ai-panel-go-to-block'], en['ai-panel-accept-block']].forEach(
      (label) => {
        expect(button(label).getAttribute('aria-describedby')).toBe(heading.id);
      }
    );
  });

  describe('a rewrite', () => {
    const withRewrite = () =>
      fakeSession({
        done: true,
        corrections: [
          correction(1),
          correction(2),
          correction(3, { rewrite: true }),
        ],
      });

    it('says it is one, and why it is to be read', async () => {
      mount(withRewrite());
      await Vue.nextTick();
      const mark = steps.$el.querySelector('#ai-rewrite-3');
      expect(mark.textContent).toContain(en['ai-panel-correction-rewrite']);
      expect(mark.textContent).toContain(
        en['ai-panel-correction-rewrite-hint']
      );
      expect(mark.getAttribute('title')).toBe(
        en['ai-panel-correction-rewrite-hint']
      );
      expect(steps.$el.querySelector('#ai-rewrite-1')).toBeNull();
      expect(fr['ai-panel-correction-rewrite']).toBe('Réécriture');
    });

    it('is left out of « Accept all », whose label says so', async () => {
      const session = withRewrite();
      mount(session);
      await Vue.nextTick();
      expect(button(en['ai-panel-accept-all'])).toBeUndefined();
      button(en['ai-panel-accept-all-but-rewrites']).click();
      expect(session.accept.mock.calls.map(([id]) => id)).toEqual([1, 2]);
      expect(session.acceptAll).not.toHaveBeenCalled();
      expect(announced).toContain(
        '2 corrections accepted. 1 rewrite left to review.'
      );
    });

    it('is left out of « Accept all in this block »', async () => {
      const session = withRewrite();
      mount(session);
      await Vue.nextTick();
      button(en['ai-panel-accept-block-but-rewrites']).click();
      expect(session.accept.mock.calls.map(([id]) => id)).toEqual([1, 2]);
      expect(session.acceptBlock).not.toHaveBeenCalled();
    });

    it('is accepted on its own', async () => {
      const session = withRewrite();
      mount(session);
      await Vue.nextTick();
      steps.$refs['accept-3'][0].click();
      expect(session.accept).toHaveBeenCalledWith(3);
    });

    it('leaves « Accept all » to the session when there is none', async () => {
      const session = fakeSession({
        done: true,
        corrections: [correction(1), correction(2)],
      });
      mount(session);
      await Vue.nextTick();
      button(en['ai-panel-accept-all']).click();
      expect(session.acceptAll).toHaveBeenCalledTimes(1);
      expect(session.accept).not.toHaveBeenCalled();
    });
  });
});

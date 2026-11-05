/**
 * @jest-environment jsdom
 */

'use strict';

// The steps of an AI action put their main buttons in the panel's foot
// (ADR 0020, boards a3 to a5), and the summary closes a correction.

const Vue = require('vue/dist/vue.common');
const {
  AiCorrectionsSteps,
} = require('../../../packages/editor/src/js/vue/components/ai-panel/ai-corrections-steps.js');
const {
  AiProposalsSteps,
} = require('../../../packages/editor/src/js/vue/components/ai-panel/ai-proposals-steps.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const t = (key, params = {}) =>
  Object.keys(params).reduce((s, k) => `${s} ${params[k]}`, key);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(component, session, extra = {}) {
  const events = { footer: [], back: 0, open: [] };
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = new Vue({
    data: () => ({ session }),
    render(h) {
      return h(component, {
        ref: 'steps',
        props: {
          vm: { t },
          session: this.session,
          action: extra.action || null,
          labelsOf: () => ({
            generate: 'gen',
            proposals: 'props',
            continueWith: 'next',
          }),
        },
        on: {
          footer: (buttons) => events.footer.push(buttons),
          back: () => (events.back += 1),
          'open-action': (id) => events.open.push(id),
          announce: () => {},
        },
      });
    },
  }).$mount(el);
  return {
    app,
    steps: app.$refs.steps,
    events,
    last: () => events.footer[events.footer.length - 1],
  };
}

const correction = (id, status = 'pending') => ({
  id,
  status,
  before: 'a',
  after: 'b',
  reason: 'r',
  blockId: 'b1',
  role: 'text',
});

function correctionsSession(state) {
  return {
    state: {
      target: { kind: 'email' },
      corrections: [],
      isLoading: false,
      done: true,
      stopped: false,
      progress: { done: 3, total: 3 },
      failedBlocks: [],
      error: null,
      ...state,
    },
    request: jest.fn(() => Promise.resolve()),
    stop: jest.fn(),
    acceptAll: jest.fn(() => ({ accepted: 1, stale: 0 })),
    blockLabel: () => 'Cover · bloc 2',
    canGoToBlock: () => true,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the steps of a correction, in the foot', () => {
  it('offers to stop the analysis and to accept what came (board a4)', async () => {
    const session = correctionsSession({
      isLoading: true,
      done: false,
      progress: { done: 1, total: 3 },
      corrections: [correction('c1'), correction('c2')],
    });
    const { steps, last } = mount(AiCorrectionsSteps, session);
    await flush();
    expect(last().map((b) => b.id)).toEqual(['stop', 'accept-all']);
    expect(last()[1].label).toBe('ai-panel-accept-all-count 2');
    steps.onFooter('stop');
    expect(session.stop).toHaveBeenCalled();
  });

  it('sums up once everything is answered, and closes with « Terminé » (board a5)', async () => {
    const session = correctionsSession({
      corrections: [correction('c1', 'accepted'), correction('c2', 'ignored')],
      tooLong: 1,
    });
    const { steps, last, events, app } = mount(AiCorrectionsSteps, session);
    await flush();
    await Vue.nextTick();
    expect(app.$el.querySelector('.ai-panel__finished')).not.toBeNull();
    const rows = [...app.$el.querySelectorAll('.ai-panel__tally dt')].map(
      (d) => d.textContent
    );
    expect(rows).toEqual([
      'ai-panel-tally-accepted-one 1',
      'ai-panel-tally-ignored-one 1',
      'ai-panel-tally-too-long-one 1',
    ]);
    expect(last().map((b) => b.id)).toEqual(['review', 'done']);
    steps.onFooter('done');
    expect(events.back).toBe(1);
  });

  it('keeps the focus in the steps when everything is accepted during the analysis', async () => {
    const session = correctionsSession({
      isLoading: true,
      done: false,
      progress: { done: 1, total: 3 },
      corrections: [correction('c1')],
    });
    session.acceptAll = jest.fn(() => {
      session.state.corrections[0].status = 'accepted';
      return { accepted: 1, stale: 0 };
    });
    const { steps, app } = mount(AiCorrectionsSteps, session);
    await flush();
    steps.onFooter('accept-all');
    await Vue.nextTick();
    await Vue.nextTick();
    expect(app.$el.contains(document.activeElement)).toBe(true);
  });

  it('says a stopped analysis was stopped, and what it did not read', async () => {
    const session = correctionsSession({
      stopped: true,
      progress: { done: 2, total: 5 },
      failedBlocks: ['b9'],
      corrections: [correction('c1', 'accepted')],
    });
    const { app } = mount(AiCorrectionsSteps, session);
    await flush();
    await Vue.nextTick();
    const finished = app.$el.querySelector('.ai-panel__finished').textContent;
    expect(finished).toContain('ai-panel-analysis-stopped');
    expect(finished).toContain('ai-panel-blocks-read-one 1');
    const unread = [...app.$el.querySelectorAll('.ai-panel__tally dt')].map(
      (d) => d.textContent
    );
    expect(unread).toContain('ai-panel-tally-not-analysed 3');
    expect(unread).toContain('ai-panel-tally-failed-one 1');
  });

  it('shows the corrections again from the summary', async () => {
    const session = correctionsSession({
      corrections: [correction('c1', 'accepted')],
    });
    const { steps, app } = mount(AiCorrectionsSteps, session);
    await flush();
    steps.onFooter('review');
    await Vue.nextTick();
    expect(app.$el.querySelector('.ai-panel__finished')).toBeNull();
    expect(app.$el.querySelector('.ai-panel__correction')).not.toBeNull();
  });
});

describe('the steps of a proposal, in the foot', () => {
  const proposals = (state) => ({
    state: {
      action: 'generate-subject',
      proposals: [],
      selectedIndex: null,
      isLoading: false,
      applied: null,
      error: null,
      ...state,
    },
    request: jest.fn(() => Promise.resolve()),
    nextAction: () => null,
  });

  it('proposes first, then offers others and applying the one picked (board a3)', async () => {
    const empty = mount(AiProposalsSteps, proposals({}), {
      action: { id: 'generate-subject', canApply: true },
    });
    expect(empty.last().map((b) => b.id)).toEqual(['generate']);
    document.body.innerHTML = '';
    const shown = mount(
      AiProposalsSteps,
      proposals({
        proposals: [{ text: 'A', angle: 'x', facts: { length: 1 } }],
      }),
      { action: { id: 'generate-subject', canApply: true } }
    );
    expect(shown.last().map((b) => [b.id, Boolean(b.disabled)])).toEqual([
      ['more', false],
      ['apply', true],
    ]);
  });
});

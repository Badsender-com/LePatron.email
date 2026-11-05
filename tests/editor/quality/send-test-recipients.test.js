/**
 * @jest-environment jsdom
 */

'use strict';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require('axios');
const Vue = require('vue/dist/vue.common');
const {
  SendTestPanel,
} = require('../../../packages/editor/src/js/vue/components/quality-drawer/send-test-panel.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const apps = [];

async function mountPanel(props = {}, { metadata } = {}) {
  const vm = {
    t: (key, params = {}) =>
      Object.keys(params).reduce(
        (s, k) => s.replace(`__${k}__`, params[k]),
        key
      ),
    exportHTML: jest.fn(() => '<p>email</p>'),
    metadata: metadata || { id: 'm1', groupId: 'grp' },
    notifier: { success: jest.fn(), error: jest.fn() },
    quality: { review: jest.fn(() => null) },
  };
  const events = {};
  document.body.innerHTML = '<div id="root"></div>';
  const app = new Vue({
    data: () => ({ extra: { active: true, ...props } }),
    render(h) {
      return h(SendTestPanel, {
        props: { vm, ...this.extra },
        on: {
          'show-results': () => (events.showResults = true),
          'run-checks': () => (events.runChecks = true),
        },
      });
    },
  }).$mount('#root');
  apps.push(app);
  await flush();
  return { vm, app, el: app.$el, events, panel: app.$children[0] };
}

const submit = (el) =>
  el.querySelector('form').dispatchEvent(new Event('submit'));

beforeEach(() => {
  axios.get.mockReset();
  axios.post.mockReset();
  axios.get.mockResolvedValue({
    data: { items: [{ name: 'Marketing team', id: 'g1' }] },
  });
  axios.post.mockResolvedValue({});
});

afterEach(() => {
  apps.splice(0).forEach((app) => app.$destroy());
});

// The « Destinataires » field of the send test tab (board q4): addresses and
// a saved list as chips; and what the tab says once sent (board q5). The tab
// itself: send-test-panel.test.js.
describe('the recipients of a test, and what is said once sent', () => {
  it('says the subject the server sent it with (board q5)', async () => {
    axios.post.mockResolvedValue({
      data: { result: ['a@b.co'], subject: 'Nos nouveautés' },
    });
    const { el, panel } = await mountPanel({ status: 'done' });
    panel.chips = [{ kind: 'email', value: 'a@b.co' }];
    await Vue.nextTick();
    submit(el);
    await flush();
    expect(el.querySelector('.qc-notice--success').textContent).toContain(
      'quality-test-sent-subject'
    );
    expect(panel.sent.subject).toBe('Nos nouveautés');
  });

  it('says how many were sent to, as the server counts them', async () => {
    axios.post.mockResolvedValue({
      data: { result: ['a@b.co', 'x@y.co', 'z@y.co'] },
    });
    const { el, panel } = await mountPanel({ status: 'done' });
    panel.chips = [{ kind: 'email', value: 'a@b.co' }];
    await Vue.nextTick();
    submit(el);
    await flush();
    expect(panel.sent.count).toBe(3);
  });

  it('may send an address only typed: it becomes a chip first', async () => {
    const { el, panel } = await mountPanel({ status: 'done' });
    const input = el.querySelector('.qc-recipients__input');
    input.value = 'a@b.co';
    input.dispatchEvent(new Event('input'));
    await Vue.nextTick();
    expect(panel.canSend).toBe(true);
    submit(el);
    await flush();
    expect(axios.post.mock.calls[0][1].rcpt).toBe('a@b.co');
  });

  it('keeps one chip per address, whatever its case', async () => {
    const { el, panel } = await mountPanel({ status: 'done' });
    const input = el.querySelector('.qc-recipients__input');
    input.value = 'a@b.co A@b.co a@b.co';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await Vue.nextTick();
    expect(panel.chips).toEqual([{ kind: 'email', value: 'a@b.co' }]);
  });

  it('closes the lists on Escape, keeping what was typed', async () => {
    const { el } = await mountPanel({ status: 'done' });
    const input = el.querySelector('.qc-recipients__input');
    input.value = 'mark';
    input.dispatchEvent(new Event('input'));
    await Vue.nextTick();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await Vue.nextTick();
    expect(input.value).toBe('mark');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('makes chips of the addresses typed, and of one saved list', async () => {
    const { el, panel } = await mountPanel({ status: 'done' });
    const input = el.querySelector('.qc-recipients__input');
    input.value = 'a@b.co c@d.fr';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await Vue.nextTick();
    input.value = 'market';
    input.dispatchEvent(new Event('input'));
    await Vue.nextTick();
    el.querySelector('.qc-recipients__option').dispatchEvent(
      new Event('mousedown')
    );
    await Vue.nextTick();
    expect(panel.chips.map((chip) => chip.value || chip.label)).toEqual([
      'a@b.co',
      'c@d.fr',
      'Marketing team',
    ]);
    // Backspace in the empty field takes the last one off.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    await Vue.nextTick();
    expect(panel.chips).toHaveLength(2);
  });

  it('names its field: a label for the recipients, the help apart', async () => {
    const { el } = await mountPanel({ status: 'done' });
    const input = el.querySelector('.qc-recipients__input');
    const label = el.querySelector(`label[for="${input.id}"]`);
    expect(label.textContent.trim()).toBe('quality-recipients');
    const help = document.getElementById(
      input.getAttribute('aria-describedby')
    );
    expect(help.textContent).toContain('quality-recipients-help');
  });
});

/**
 * @jest-environment jsdom
 */

'use strict';

jest.mock('axios', () => ({
  get: jest.fn(() =>
    Promise.resolve({ data: { items: [{ name: 'Marketing team', id: 'g1' }] } })
  ),
  post: jest.fn(() => Promise.resolve({})),
}));

const axios = require('axios');
const Vue = require('vue/dist/vue.common');
const {
  SendTestPanel,
} = require('../../../packages/editor/src/js/vue/components/quality-drawer/send-test-panel.js');
const {
  areEmails,
} = require('../../../packages/editor/src/js/vue/components/send-test/send-test-api.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mountPanel(props = {}) {
  const vm = {
    t: (key, params = {}) =>
      Object.keys(params).reduce(
        (s, k) => s.replace(`__${k}__`, params[k]),
        key
      ),
    exportHTML: () => '<p>email</p>',
    metadata: { id: 'm1', groupId: 'grp' },
    notifier: { success: jest.fn(), error: jest.fn() },
  };
  const events = {};
  document.body.innerHTML = '<div id="root"></div>';
  const app = new Vue({
    render: (h) =>
      h(SendTestPanel, {
        props: { vm, ...props },
        on: {
          'show-results': () => (events.showResults = true),
          'run-checks': () => (events.runChecks = true),
        },
      }),
  }).$mount('#root');
  await flush();
  return { vm, el: app.$el, events, panel: app.$children[0] };
}

beforeEach(() => axios.post.mockClear());

describe('areEmails', () => {
  it('accepts a semicolon-separated list, and an empty one', () => {
    expect(areEmails('a@b.co; c@d.fr')).toBe(true);
    expect(areEmails('')).toBe(true);
    expect(areEmails('a@b.co; nope')).toBe(false);
  });
});

describe('SendTestPanel', () => {
  it('sends the email as it is now to the recipients and the saved list', async () => {
    const { vm, el, panel } = await mountPanel({ status: 'done' });
    panel.recipients = 'a@b.co';
    panel.selectedGroup = { label: 'Marketing team', code: 'g1' };
    await Vue.nextTick();

    el.querySelector('form').dispatchEvent(new Event('submit'));
    await flush();

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('m1'), {
      rcpt: 'a@b.co',
      html: '<p>email</p>',
      emailsGroupId: 'g1',
    });
    expect(vm.notifier.success).toHaveBeenCalledWith('send-test-success');
  });

  it('refuses to send to an invalid address, and says why', async () => {
    const { el, panel } = await mountPanel({ status: 'done' });
    panel.recipients = 'not an email';
    await Vue.nextTick();

    el.querySelector('form').dispatchEvent(new Event('submit'));
    await flush();

    expect(axios.post).not.toHaveBeenCalled();
    expect(el.querySelector('.qc-field__help').textContent.trim()).toBe(
      'emails-invalid'
    );
    expect(el.querySelector('button[type="submit"]').disabled).toBe(true);
  });

  it('recalls the errors left, without stopping the send', async () => {
    const { el, events } = await mountPanel({ status: 'done', errorCount: 2 });
    expect(el.querySelector('.qc-notice--error').textContent).toContain(
      '2 errors'
    );
    el.querySelector('.qc-notice .qc-link-button').click();
    expect(events.showResults).toBe(true);
  });

  it('offers to run the checks when they never ran', async () => {
    const { el, events } = await mountPanel({ status: 'idle' });
    el.querySelector('.qc-notice .qc-link-button').click();
    expect(events.runChecks).toBe(true);
  });

  it('lists the saved lists of addresses', async () => {
    const { el } = await mountPanel({ status: 'done' });
    expect(el.textContent).toContain('Saved list of addresses');
  });
});

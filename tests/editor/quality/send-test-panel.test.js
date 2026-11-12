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
const {
  areEmails,
  normalizeRecipients,
} = require('../../../packages/editor/src/js/vue/components/send-test/send-test-api.js');

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

describe('the recipients', () => {
  it('accepts a semicolon-separated list, spaces included, and an empty one', () => {
    expect(areEmails('a@b.co; c@d.fr')).toBe(true);
    expect(areEmails('')).toBe(true);
    expect(areEmails('a@b.co; nope')).toBe(false);
  });

  it('are sent as the server reads them: trimmed, without empty entries', () => {
    expect(normalizeRecipients(' a@b.co ; c@d.fr ;; ')).toBe('a@b.co;c@d.fr');
  });
});

describe('SendTestPanel', () => {
  it('sends the email to the recipients and the saved list, spaces removed', async () => {
    const { vm, el, panel } = await mountPanel({ status: 'done' });
    panel.chips = [
      { kind: 'email', value: 'a@b.co' },
      { kind: 'email', value: 'c@d.fr' },
      { kind: 'list', label: 'Marketing team', code: 'g1' },
    ];
    await Vue.nextTick();

    submit(el);
    await flush();

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('m1'), {
      rcpt: 'a@b.co;c@d.fr',
      html: '<p>email</p>',
      emailsGroupId: 'g1',
    });
    // Said in the tab (board q5), not by a second notice.
    expect(el.querySelector('.qc-notice--success').textContent).toContain(
      'quality-test-sent'
    );
    expect(vm.notifier.success).not.toHaveBeenCalled();
  });

  it('reviews the very HTML it sends, exported once, without opening anything', async () => {
    const { vm, el, panel } = await mountPanel({ status: 'done' });
    panel.chips = [{ kind: 'email', value: 'a@b.co' }];
    await Vue.nextTick();

    submit(el);
    await flush();

    expect(vm.exportHTML).toHaveBeenCalledTimes(1);
    expect(vm.quality.review).toHaveBeenCalledWith({
      html: '<p>email</p>',
      silent: true,
    });
    expect(axios.post.mock.calls[0][1].html).toBe('<p>email</p>');
  });

  it('sends even when the review throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { vm, el, panel } = await mountPanel({ status: 'done' });
    vm.quality.review.mockImplementation(() => {
      throw new Error('boom');
    });
    panel.chips = [{ kind: 'email', value: 'a@b.co' }];
    await Vue.nextTick();

    submit(el);
    await flush();
    expect(axios.post).toHaveBeenCalledTimes(1);
    console.error.mockRestore();
  });

  it('says when the email cannot be exported, sends nothing, and lets the user try again', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { vm, el, panel } = await mountPanel({ status: 'done' });
    vm.exportHTML.mockImplementation(() => {
      throw new Error('export failed');
    });
    panel.chips = [{ kind: 'email', value: 'a@b.co' }];
    await Vue.nextTick();

    submit(el);
    await flush();
    await Vue.nextTick();

    expect(vm.exportHTML).toHaveBeenCalledTimes(1);
    expect(axios.post).not.toHaveBeenCalled();
    expect(vm.notifier.error).toHaveBeenCalledWith('send-test-error');
    expect(panel.canSend).toBe(true);
    console.error.mockRestore();
  });

  it('refuses to send to an invalid address, and says why', async () => {
    const { el, panel } = await mountPanel({ status: 'done' });
    const input = el.querySelector('.qc-recipients__input');
    input.value = 'not an email';
    input.dispatchEvent(new Event('input'));
    await Vue.nextTick();

    submit(el);
    await flush();

    expect(axios.post).not.toHaveBeenCalled();
    expect(el.querySelector('.qc-field__help--error').textContent.trim()).toBe(
      'quality-recipients-invalid'
    );
    expect(panel.canSend).toBe(false);
  });

  it('says when the server refuses, keeps what was typed, and lets the user try again', async () => {
    axios.post.mockRejectedValue({ response: { status: 400 } });
    const { vm, el, panel } = await mountPanel({ status: 'done' });
    panel.chips = [{ kind: 'email', value: 'a@b.co' }];
    await Vue.nextTick();

    submit(el);
    await flush();
    await Vue.nextTick();

    expect(vm.notifier.error).toHaveBeenCalledWith('send-test-error');
    expect(panel.chips).toEqual([{ kind: 'email', value: 'a@b.co' }]);
    expect(panel.canSend).toBe(true);
  });

  it('sends once when submitted again while sending', async () => {
    let answer;
    axios.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );
    const { el, panel } = await mountPanel({ status: 'done' });
    panel.chips = [{ kind: 'email', value: 'a@b.co' }];
    await Vue.nextTick();

    submit(el);
    await Vue.nextTick();
    expect(panel.canSend).toBe(false);
    submit(el);
    await flush();
    expect(axios.post).toHaveBeenCalledTimes(1);

    answer({});
    await flush();
    expect(panel.canSend).toBe(true);
  });

  it('recalls what is left to fix, without stopping the send', async () => {
    const { el, events } = await mountPanel({
      status: 'done',
      ready: false,
      issueCount: 2,
    });
    expect(el.querySelector('.qc-notice').textContent).toContain(
      'quality-send-not-ready'
    );
    el.querySelector('.qc-notice .qc-link-button').click();
    expect(events.showResults).toBe(true);
  });

  it('offers to run the checks when they never ran, or ran on an earlier version', async () => {
    for (const status of ['idle', 'stale']) {
      const { el, events } = await mountPanel({ status, issueCount: 2 });
      expect(el.querySelector('.qc-notice').textContent).toContain(
        'The quality checks have not run on this version yet'
      );
      el.querySelector('.qc-notice .qc-link-button').click();
      expect(events.runChecks).toBe(true);
    }
  });

  it('says the checks are running, without offering to run them again', async () => {
    const { el } = await mountPanel({ status: 'running' });
    expect(el.querySelector('.qc-notice').textContent).toContain(
      'Running checks…'
    );
    expect(el.querySelector('.qc-notice .qc-link-button')).toBeNull();
  });

  it('loads the saved lists only once the tab is shown', async () => {
    const { app } = await mountPanel({ status: 'done', active: false });
    expect(axios.get).not.toHaveBeenCalled();

    app.extra = { ...app.extra, active: true };
    await flush();
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(app.$children[0].emailGroups).toHaveLength(1);

    app.extra = { ...app.extra, active: false };
    await flush();
    app.extra = { ...app.extra, active: true };
    await flush();
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('asks for no list without a company', async () => {
    await mountPanel({ status: 'done' }, { metadata: { id: 'm1' } });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('says when the saved lists could not be loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockRejectedValue(new Error('500'));
    const { vm } = await mountPanel({ status: 'done' });
    expect(vm.notifier.error).toHaveBeenCalledWith(
      'The saved lists of addresses could not be loaded'
    );
    console.error.mockRestore();
  });
});

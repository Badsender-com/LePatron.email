/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Acceptance tests of the ready rule (ADR 0020): an email is ready when no
 * error or warning is left unignored and every check ran; an info counts only
 * if it blocks. It is the rule the top bar badge called `cleared`, renamed
 * `ready`, and now the one rule of the rail badge, the card of the quality
 * panel and the banner of the send test tab, which counted errors only.
 */

const ko = require('knockout');
const Vue = require('vue/dist/vue.common');
const {
  createCounts,
} = require('../../../packages/editor/src/js/ext/quality/quality-counts.js');
const {
  SendTestPanel,
} = require('../../../packages/editor/src/js/vue/components/quality-drawer/send-test-panel.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const finding = (severity, fields = {}) => ({ severity, ...fields });
const PASSED = { status: 'passed' };

function countsOf(findings, checks = [PASSED], remoteStatus = 'idle') {
  return createCounts(ko, {
    active: ko.observable(findings),
    checks: ko.observable(checks),
    remoteStatus: ko.observable(remoteStatus),
  });
}

async function mountBanner(props) {
  const vm = {
    t: (key, params = {}) =>
      Object.keys(params).reduce(
        (s, k) => s.replace(`__${k}__`, params[k]),
        key
      ),
    exportHTML: jest.fn(() => '<p>email</p>'),
    metadata: { id: 'm1', groupId: 'grp' },
    notifier: { success: jest.fn(), error: jest.fn() },
    quality: { review: jest.fn(() => null) },
  };
  document.body.innerHTML = '<div id="root"></div>';
  const app = new Vue({
    render: (h) => h(SendTestPanel, { props: { vm, active: false, ...props } }),
  }).$mount('#root');
  await new Promise((resolve) => setTimeout(resolve, 0));
  return app;
}

describe('the ready rule (ADR 0020)', () => {
  describe('ready', () => {
    it('is ready with infos left, the rename of cleared', () => {
      const counts = countsOf([finding('info')]);
      expect(counts.ready()).toBe(true);
      expect(counts.cleared).toBeUndefined();
    });

    it('is not ready with a warning, nor with a blocking info', () => {
      expect(countsOf([finding('warning')]).ready()).toBe(false);
      expect(countsOf([finding('info', { blocking: true })]).ready()).toBe(
        false
      );
    });

    it('is not ready while a check did not run', () => {
      expect(countsOf([], [PASSED, { status: 'error' }]).ready()).toBe(false);
    });

    it("is not ready while the server's checks are awaited", () => {
      expect(countsOf([], [PASSED], 'running').ready()).toBe(false);
    });

    it('gives no verdict without a check', () => {
      expect(countsOf([], []).ready()).toBe(false);
    });
  });

  describe('the banner of the send test tab', () => {
    let app;
    afterEach(() => app && app.$destroy());

    it('recalls the warnings left too, not only the errors', async () => {
      app = await mountBanner({ status: 'done', ready: false, issueCount: 2 });
      expect(app.$el.querySelector('.qc-notice').textContent).toContain(
        '2 issues are still to fix'
      );
    });

    it('is shown while a check did not run, with no point to fix', async () => {
      app = await mountBanner({ status: 'done', ready: false, issueCount: 0 });
      expect(app.$el.querySelector('.qc-notice').textContent).toContain(
        'A check could not run'
      );
    });

    it('is red only when something blocks the export (decision 6)', async () => {
      app = await mountBanner({ status: 'done', ready: false, issueCount: 2 });
      expect(app.$el.querySelector('.qc-notice--error')).toBeNull();
      app.$destroy();
      app = await mountBanner({
        status: 'done',
        ready: false,
        issueCount: 2,
        blockingCount: 1,
      });
      expect(app.$el.querySelector('.qc-notice--error')).not.toBeNull();
    });

    it('is gone once the email is ready, infos left or not', async () => {
      // errorCount, the old prop, no longer decides.
      app = await mountBanner({
        status: 'done',
        ready: true,
        issueCount: 0,
        errorCount: 3,
      });
      expect(app.$el.querySelector('.qc-notice')).toBeNull();
    });
  });
});

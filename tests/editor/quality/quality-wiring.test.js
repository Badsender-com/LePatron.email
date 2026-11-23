/**
 * @jest-environment jsdom
 */

'use strict';

// How the quality review is wired into the editor: the plugin that mounts the
// drawer next to the comments panel, and the two exports that go through its
// gate (download, ESP): what blocks stops them, a failure of the checks never
// does.

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { items: [] } })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
}));
jest.mock(
  '../../../packages/editor/src/js/ext/badsender-control-quality',
  () => ({
    displayBlockingFindings: jest.fn(),
    displayWaitingForChecks: jest.fn(() => ({ close: jest.fn() })),
  })
);

const ko = require('knockout');
const {
  installRightPanel,
} = require('../../../packages/editor/src/js/ext/right-panel.js');
const $ = require('jquery');
const axios = require('axios');
const Vue = require('vue/dist/vue.common');
const qualityDrawerPlugin = require('../../../packages/editor/src/js/vue/qualityDrawerPlugin.js');
const serverStorage = require('../../../packages/editor/src/js/ext/badsender-server-storage.js');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');
const { fakeViewModel } = require('./fake-view-model');

Vue.config.productionTip = false;
Vue.config.devtools = false;

function editorWithReview(review) {
  const vm = fakeViewModel();
  vm.notifier = { info: jest.fn(), success: jest.fn(), error: jest.fn() };
  vm.metadata.url = {
    zip: '/api/m1/zip',
    update: '/api/m1',
    sendCampaignMail: '/api/m1/send',
  };
  vm.metadata.name = () => 'Soldes';
  vm.headCss = () => '';
  vm.quality = { review };
  return vm;
}

describe('qualityDrawerPlugin', () => {
  it('installs the review, then mounts the drawer, exclusive with the comments panel', () => {
    const vm = fakeViewModel();
    vm.notifier = { warning: jest.fn() };
    // The comments are a flag of the same right panel, as badsender-comments.js
    // installs them.
    vm.showComments = installRightPanel(vm, ko).flag('comments');
    // As toolbox.tmpl.html declares it.
    document.body.innerHTML =
      '<div id="quality-drawer"><quality-drawer-plugin></quality-drawer-plugin></div>';

    qualityDrawerPlugin.viewModel(vm, ko);
    expect(vm.quality).toBeDefined();
    qualityDrawerPlugin.init(vm);
    expect(document.querySelector('.qc-drawer')).not.toBeNull();

    vm.showQuality(true);
    vm.showComments(true);
    expect(vm.showQuality()).toBe(false);
    vm.showQuality(true);
    expect(vm.showComments()).toBe(false);
  });
});

describe('the download command', () => {
  let ajax;
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ajax = jest.spyOn($, 'ajax').mockImplementation(() => ({}));
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('greys the button before the checks run, then gates the very HTML the ZIP is built from', async () => {
    let deferred;
    const run = jest.fn(() => ({ findings: [], checks: [] }));
    const vm = editorWithReview(undefined);
    installQualityReview(vm, ko, {
      run,
      defer: (fn) => (deferred = fn),
      watchContent: () => () => {},
    });
    serverStorage({ metadata: vm.metadata })(vm);

    vm.download.execute();
    expect(vm.download.enabled()).toBe(false);
    expect(run).not.toHaveBeenCalled();
    deferred();
    await flush();

    expect(run.mock.calls[0][1]).toEqual({
      html: vm.exportHTML.mock.results[0].value,
    });
    expect(ajax).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ajax.mock.calls[0][0].data).html).toBe(
      vm.exportHTML.mock.results[0].value
    );
    expect(vm.exportHTML).toHaveBeenCalledTimes(1);
  });

  it('downloads the HTML and the tracking the checks saw, even if the email changes meanwhile', async () => {
    let deferred;
    const vm = editorWithReview(undefined);
    const tracking = ko.observable({ utm_source: 'checked' });
    vm.content = () => ({ tracking });
    installQualityReview(vm, ko, {
      run: () => ({ findings: [], checks: [] }),
      defer: (fn) => (deferred = fn),
      watchContent: () => () => {},
    });
    serverStorage({ metadata: vm.metadata })(vm);

    vm.download.execute();
    vm.exportHTML.mockReturnValue('<p>edited during the checks</p>');
    tracking({ utm_source: 'edited' });
    deferred();
    await flush();

    const sent = JSON.parse(ajax.mock.calls[0][0].data);
    expect(sent.html).toBe(vm.exportHTML.mock.results[0].value);
    expect(sent.tracking).toEqual({ utm_source: 'checked' });
  });

  it('goes on when the checks throw', async () => {
    const vm = editorWithReview(undefined);
    installQualityReview(vm, ko, {
      run: () => {
        throw new Error('boom');
      },
      defer: (fn) => fn(),
      watchContent: () => () => {},
    });
    serverStorage({ metadata: vm.metadata })(vm);

    vm.download.execute();
    await flush();

    expect(ajax).toHaveBeenCalledTimes(1);
  });

  it('does not download when the gate keeps the email, and gives the button back', async () => {
    const vm = editorWithReview(jest.fn());
    vm.quality.gate = jest.fn(() => Promise.resolve({ leaves: false }));
    serverStorage({ metadata: vm.metadata })(vm);

    vm.download.execute();
    await flush();

    expect(ajax).not.toHaveBeenCalled();
    expect(vm.download.enabled()).toBe(true);
  });

  it('carries no test command: sending a test lives in the drawer', () => {
    const vm = editorWithReview(jest.fn());
    serverStorage({ metadata: vm.metadata })(vm);
    expect(vm.test).toBeUndefined();
  });

  it('downloads once the checks found nothing blocking', async () => {
    const vm = editorWithReview(undefined);
    const run = jest.fn(() => ({ findings: [], checks: [] }));
    installQualityReview(vm, ko, {
      run,
      defer: (fn) => fn(),
      watchContent: () => () => {},
    });
    serverStorage({ metadata: vm.metadata })(vm);

    vm.download.execute();
    await flush();

    expect(run).toHaveBeenCalled();
    expect(ajax).toHaveBeenCalledTimes(1);
  });
});

describe('the ESP send', () => {
  const {
    EspComponent,
  } = require('../../../packages/editor/src/js/vue/components/esp/esp-send-mail.js');
  const { handleProfileSelect, submitEsp } = EspComponent.options.methods;

  // The component as its methods see it.
  function espForm(vm, rest = {}) {
    return {
      vm,
      type: 'creation',
      campaignId: null,
      isLoadingExport: false,
      checkedExport: null,
      fetchData: jest.fn(() => Promise.resolve()),
      checkIfAlreadySendMailWithProfile: jest.fn(),
      fetchProfileData: jest.fn(),
      openModal: jest.fn(),
      closeModal: jest.fn(),
      ...rest,
    };
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.post.mockClear();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the form only when the gate lets the email leave, the profile shown as being checked', async () => {
    const vm = editorWithReview(jest.fn());
    const profile = { id: 'p1', type: 'SENDINBLUE' };
    vm.quality.gate = jest.fn(() => Promise.resolve({ leaves: false }));
    const kept = espForm(vm);
    await handleProfileSelect.call(kept, profile);
    expect(vm.quality.gate).toHaveBeenCalledWith({
      html: vm.exportHTML.mock.results[0].value,
      quiet: true,
      target: profile,
    });
    expect(kept.openModal).not.toHaveBeenCalled();
    expect(kept.selectedProfile).toBeUndefined();

    const verdict = { leaves: true, present: jest.fn() };
    vm.quality.gate = jest.fn(() => Promise.resolve(verdict));
    const opened = espForm(vm);
    await handleProfileSelect.call(opened, profile);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(opened.selectedProfile).toBe(profile);
    expect(opened.checkedExport.verdict).toBe(verdict);
    expect(opened.checkedExport.html).toBe(vm.exportHTML.mock.results[1].value);
    expect(opened.openModal).toHaveBeenCalled();
  });

  it("shows the gate's own results after the send, and confirms the send even if that throws", async () => {
    const vm = editorWithReview(jest.fn());
    const present = jest.fn(() => {
      throw new Error('boom');
    });
    const self = espForm(vm, {
      fetchedProfile: { id: 'p1', type: 'SENDINBLUE', contentSendType: 'mail' },
      checkedExport: {
        html: '<p>checked</p>',
        tracking: {},
        verdict: { leaves: true, present },
      },
    });

    await submitEsp.call(self, {});
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(present).toHaveBeenCalledTimes(1);
    expect(vm.quality.review).not.toHaveBeenCalled();
    expect(vm.notifier.success).toHaveBeenCalled();
    expect(self.closeModal).toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('sends the HTML and the tracking the gate checked, never a new export', async () => {
    const vm = editorWithReview(jest.fn());
    const tracking = ko.observable({ utm_source: 'checked' });
    vm.content = () => ({ tracking });
    const profile = { id: 'p1', type: 'SENDINBLUE' };
    vm.quality.gate = jest.fn(() =>
      Promise.resolve({ leaves: true, present: jest.fn() })
    );
    const self = espForm(vm, {
      fetchedProfile: { id: 'p1', type: 'SENDINBLUE', contentSendType: 'mail' },
    });
    await handleProfileSelect.call(self, profile);
    const checked = vm.exportHTML.mock.results[0].value;
    vm.exportHTML.mockReturnValue('<p>edited after the checks</p>');
    tracking({ utm_source: 'edited' });

    await submitEsp.call(self, {});

    const sent = axios.post.mock.calls[0][1];
    expect(sent.html).toBe(checked);
    expect(sent.tracking).toEqual({ utm_source: 'checked' });
    expect(vm.exportHTML).toHaveBeenCalledTimes(1);
  });
});

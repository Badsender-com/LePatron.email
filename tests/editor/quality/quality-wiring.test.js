/**
 * @jest-environment jsdom
 */

'use strict';

// How the quality review is wired into the editor: the plugin that mounts the
// drawer next to the comments panel, and the two exports that review what
// they send (download, ESP): a failure of the checks never blocks them.

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { items: [] } })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
}));
jest.mock(
  '../../../packages/editor/src/js/ext/badsender-control-quality',
  () => ({
    checkRequiredTrackingParams: () => [],
    displayTrackingError: jest.fn(),
  })
);

const ko = require('knockout');
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
    vm.showComments = ko.observable(false);
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

  it('gates the very HTML the ZIP is built from, and goes on even if the checks throw', async () => {
    const gate = jest.fn(() => {
      throw new Error('boom');
    });
    const vm = editorWithReview(jest.fn());
    vm.quality.gate = gate;
    serverStorage({ metadata: vm.metadata })(vm);

    vm.download.execute();
    await flush();

    expect(gate).toHaveBeenCalledWith({
      html: vm.exportHTML.mock.results[0].value,
    });
    expect(ajax).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ajax.mock.calls[0][0].data).html).toBe(
      vm.exportHTML.mock.results[0].value
    );
    expect(vm.exportHTML).toHaveBeenCalledTimes(1);
  });

  it('does not download when a blocking check has a finding', async () => {
    const vm = editorWithReview(jest.fn());
    vm.quality.gate = jest.fn(() =>
      Promise.resolve({ blocked: true, findings: [{ ruleId: 'x' }] })
    );
    serverStorage({ metadata: vm.metadata })(vm);

    vm.download.execute();
    await flush();

    expect(ajax).not.toHaveBeenCalled();
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

  it('reviews the HTML that was sent, and confirms the send even if the review throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const review = jest.fn(() => {
      throw new Error('boom');
    });
    const vm = editorWithReview(review);
    const closeModal = jest.fn();
    const self = {
      vm,
      type: 'creation',
      campaignId: null,
      fetchedProfile: { id: 'p1', type: 'SENDINBLUE', contentSendType: 'mail' },
      closeModal,
      isLoadingExport: false,
    };

    await EspComponent.options.methods.submitEsp.call(self, {});
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(review).toHaveBeenCalledWith({
      html: vm.exportHTML.mock.results[0].value,
    });
    expect(vm.notifier.success).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledTimes(1);
    console.error.mockRestore();
  });
});

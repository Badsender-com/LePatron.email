/**
 * @jest-environment jsdom
 */
'use strict';

// The settings tabs of a company that save on their own (export options,
// tracking), mounted: each sends the fields it edits that changed, never the
// company it read. A tab left open never sends back a switch, a module, or
// another tab's settings.

const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const groupChanges = require('../../../packages/ui/helpers/group-changes.js');

// The company as the tab loaded it: every switch and module on, so that one
// sent back would show.
const loaded = () => ({
  id: 'g1',
  name: 'Company A',
  enableMcpModule: true,
  enableMcp: true,
  allowRetex: true,
  requireTwoFactor: true,
  enableEmailBuilder: true,
  enableCrmIntelligence: true,
  downloadMailingWithoutEnclosingFolder: false,
  downloadMailingWithFtpImages: false,
  downloadMailingWithCdnImages: false,
  trackingConfig: { enabled: false, restrictValues: false, params: [] },
  emailMetadata: { enabled: true },
});

const OTHERS = [
  'enableMcpModule',
  'enableMcp',
  'allowRetex',
  'requireTwoFactor',
  'enableEmailBuilder',
  'enableCrmIntelligence',
  'name',
  'emailMetadata',
];

function mountTab(file, extraImports) {
  const $put = jest.fn().mockResolvedValue({});
  const vm = mountSfc(file, {
    props: { group: loaded() },
    mocks: { $t: (key) => key, $axios: { $put } },
    imports: {
      vuex: { mapMutations: () => ({ showSnackbar: jest.fn() }) },
      'lucide-vue': {},
      '~/helpers/api-routes.js': {
        groupsItem: ({ groupId }) => `/groups/${groupId}`,
      },
      '~/helpers/group-changes.js': groupChanges,
      ...extraImports,
    },
  });
  return { vm, $put };
}

const exportTab = () =>
  mountTab('packages/ui/components/group/export-options-tab.vue', {
    vuelidate: require('vuelidate'),
    'vuelidate/lib/validators': require('vuelidate/lib/validators'),
    '~/store/page': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
    '~/components/group/ftp-settings': {},
    '~/components/form/bs-text-field': {},
    '~/components/form/bs-select': {},
    '~/components/layout/bs-form-section.vue': {},
  });

const trackingTab = () =>
  mountTab('packages/ui/components/group/tracking-params-tab.vue', {
    '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
    '~/components/form/bs-text-field.vue': {},
  });

describe('the export options tab', () => {
  it('sends the export settings it changed, alone', async () => {
    const { vm, $put } = exportTab();
    await settle(vm);

    vm.localGroup.downloadMailingWithoutEnclosingFolder = true;
    await vm.onSubmit();

    expect($put).toHaveBeenCalledWith('/groups/g1', {
      downloadMailingWithoutEnclosingFolder: true,
    });
    OTHERS.forEach((field) =>
      expect($put.mock.calls[0][1]).not.toHaveProperty(field)
    );
  });

  it('sends nothing when nothing changed', async () => {
    const { vm, $put } = exportTab();
    await settle(vm);

    await vm.onSubmit();

    expect($put).not.toHaveBeenCalled();
  });
});

describe('the tracking tab', () => {
  it('sends the tracking it changed, alone', async () => {
    const { vm, $put } = trackingTab();
    await settle(vm);

    vm.onEnabledChange(true);
    await vm.onSubmit();

    expect($put).toHaveBeenCalledWith('/groups/g1', {
      trackingConfig: { enabled: true, restrictValues: false, params: [] },
    });
    OTHERS.forEach((field) =>
      expect($put.mock.calls[0][1]).not.toHaveProperty(field)
    );
  });

  it('sends nothing when nothing changed', async () => {
    const { vm, $put } = trackingTab();
    await settle(vm);

    await vm.onSubmit();

    expect($put).not.toHaveBeenCalled();
  });
});

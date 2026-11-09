/**
 * @jest-environment jsdom
 */
'use strict';

// The MCP access of a company (ADR 0012), mounted: the address to give the
// users is copied through the helper that falls back on a browser without the
// clipboard API, and a copy that fails says so, the address left in its
// field to select.

const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const mixinGroupSwitch = require('../../../packages/ui/helpers/mixins/mixin-group-switch.js');

function mountOption(copied) {
  const commit = jest.fn();
  const copy = jest.fn().mockResolvedValue(copied);
  const vm = mountSfc('packages/ui/components/group/mcp-access-option.vue', {
    props: {
      group: {
        id: 'g1',
        name: 'Company A',
        enableMcpModule: true,
        enableMcp: true,
      },
    },
    mocks: {
      $t: (key) => key,
      $store: {
        commit,
        _modulesNamespaceMap: { 'page/': { context: { commit } } },
      },
    },
    imports: {
      vuex: { mapGetters: () => ({ can: () => () => false }) },
      'lucide-vue': {},
      '~/store/user': { CAN: 'can', USER: 'user' },
      '../../../shared/access/roles.js': { CAPABILITIES: {} },
      '~/helpers/mixins/mixin-group-switch.js': mixinGroupSwitch,
      '~/helpers/copy-to-clipboard.js': { __esModule: true, default: copy },
      '~/components/layout/bs-form-section.vue': {},
      '~/components/modal-confirm.vue': {},
      '~/components/layout/bs-settings-row.vue': {},
      '~/components/group/feature-switch.vue': {},
      '~/components/group/retex-option.vue': {},
      '~/components/group/connected-applications-option.vue': {},
    },
  });
  return { vm, copy, commit };
}

const copyButton = (vm) =>
  [...vm.$el.querySelectorAll('v-btn')].find(
    (el) => el.getAttribute('aria-label') === 'mcpAccess.copyAddress'
  );

describe('the MCP address of a company', () => {
  it('is copied through the helper with a fallback', async () => {
    const { vm, copy } = mountOption(true);
    await settle(vm);

    copyButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    expect(copy).toHaveBeenCalledWith(`${window.location.origin}/mcp`);
    expect(copyButton(vm).textContent).toContain('mcpClients.copied');
  });

  it('says a failed copy, never that it is copied', async () => {
    const { vm, commit } = mountOption(false);
    await settle(vm);

    copyButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    expect(commit).toHaveBeenCalledWith('SHOW_SNACKBAR', {
      text: 'mcpClients.copyFailed',
      color: 'error',
    });
    expect(copyButton(vm).textContent).not.toContain('mcpClients.copied');
  });
});

/**
 * @jest-environment jsdom
 */
'use strict';

// The user's connected applications (ADR 0012), one row per connection: an
// assistant connected from two machines is listed twice, under the same
// name, so revoking one names the connection by its date.

require('../../../packages/ui/plugins/vue-filters.js');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

const CONNECTION = {
  id: 'c1',
  name: 'Claude Code',
  group: { id: 'g1', name: 'A client' },
  connectedAt: '2026-11-02T09:30:00.000Z',
  lastUsedAt: null,
};

function mountPage() {
  return mountSfc('packages/ui/routes/connected-applications/index.vue', {
    mocks: {
      $t: (key, params = {}) => [key, ...Object.values(params)].join(' | '),
      $i18n: { locale: 'fr' },
      $store: { commit: jest.fn(), _modulesNamespaceMap: {} },
    },
    imports: {
      vuex: { mapMutations: () => ({}) },
      'lucide-vue': { Plug: {}, Unplug: {} },
      '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
      '~/helpers/pages-acls.js': { ACL_USER: 'user' },
      '~/helpers/api-routes.js': {},
      '~/helpers/constants/error-codes.js': require('../../../packages/ui/helpers/constants/error-codes.js'),
      '~/helpers/mixins/mixin-page-title.js': {},
      '~/components/layout/bs-page-header.vue': {},
      '~/components/modal-confirm.vue': {},
    },
  });
}

describe('revoking a connection', () => {
  it('names the connection by its date, beside its application and company', async () => {
    const vm = mountPage();
    vm.toRevoke = CONNECTION;
    await settle(vm);

    const confirm = vm.$el.querySelector('bs-modal-confirm p').textContent;
    expect(confirm).toContain('connectedApplications.revokeConfirm');
    expect(confirm).toContain('Claude Code');
    expect(confirm).toContain('A client');
    expect(confirm).toContain('02/11/2026 10:30');
  });

  it('labels each row by its date', () => {
    const vm = mountPage();

    expect(vm.connectedOn(CONNECTION)).toBe('02/11/2026 10:30');
  });

  it.each([
    ['fr', fr, /connexion de « \{name\} » du \{date\}.*autres connexions/],
    ['en', en, /connection of “\{name\}” of \{date\}.*other connections/],
  ])('says it in %s', (_lang, messages, confirm) => {
    expect(messages.connectedApplications.revokeConfirm).toMatch(confirm);
    expect(messages.connectedApplications.revokeOne).toContain('{date}');
  });
});

describe('revoking a connection already gone', () => {
  it('says so, and lists it no more', async () => {
    const showSnackbar = jest.fn();
    const vm = mountSfc('packages/ui/routes/connected-applications/index.vue', {
      mocks: {
        $t: (key) => key,
        $i18n: { locale: 'fr' },
        $axios: {
          $delete: jest.fn().mockRejectedValue(
            Object.assign(new Error('MCP_CONNECTION_NOT_FOUND'), {
              response: {
                status: 404,
                data: { message: 'MCP_CONNECTION_NOT_FOUND' },
              },
            })
          ),
        },
      },
      imports: {
        vuex: { mapMutations: () => ({ showSnackbar }) },
        'lucide-vue': { Plug: {}, Unplug: {} },
        '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
        '~/helpers/pages-acls.js': { ACL_USER: 'user' },
        '~/helpers/api-routes.js': { connectedApplicationsItem: () => '/c1' },
        '~/helpers/constants/error-codes.js': require('../../../packages/ui/helpers/constants/error-codes.js'),
        '~/helpers/mixins/mixin-page-title.js': {},
        '~/components/layout/bs-page-header.vue': {},
        '~/components/modal-confirm.vue': {},
      },
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    vm.applications = [CONNECTION];
    vm.toRevoke = CONNECTION;

    await vm.revoke();
    await settle(vm);

    expect(showSnackbar).toHaveBeenCalledWith({
      text: 'connectedApplications.errors.MCP_CONNECTION_NOT_FOUND',
      color: 'error',
    });
    expect(vm.applications).toEqual([]);
  });
});

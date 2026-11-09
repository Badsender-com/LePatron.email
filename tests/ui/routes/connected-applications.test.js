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
const { CAPABILITIES } = require('../../../packages/shared/access/roles.js');

const CONNECTION = {
  id: 'c1',
  name: 'Claude Code',
  group: { id: 'g1', name: 'A client', enableMcpModule: true, enableMcp: true },
  connectedAt: '2026-11-02T09:30:00.000Z',
  lastUsedAt: null,
};

// What the page imports, with the user the store holds: whether they manage
// the platform, and the company whose modules the screens show (the selected
// one for a super admin, anyone else's own).
function importsOf({
  canManagePlatform = false,
  modulesGroup = null,
  showSnackbar = jest.fn(),
  apiRoutes = {},
} = {}) {
  return {
    vuex: {
      mapGetters: () => ({
        can: () => (capability) =>
          capability === CAPABILITIES.PLATFORM_MANAGE && canManagePlatform,
        modulesGroup: () => modulesGroup,
      }),
      mapMutations: () => ({ showSnackbar }),
    },
    'lucide-vue': { Plug: {}, Unplug: {} },
    '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
    '~/store/user.js': {
      CAN: 'CAN',
      MODULES_GROUP: 'MODULES_GROUP',
      USER: 'user',
    },
    '~/helpers/pages-acls.js': { ACL_USER: 'user' },
    '~/helpers/api-routes.js': apiRoutes,
    '~/helpers/constants/error-codes.js': require('../../../packages/ui/helpers/constants/error-codes.js'),
    '~/helpers/mixins/mixin-page-title.js': {},
    '~/helpers/module-activation.js': require('../../../packages/ui/helpers/module-activation.js'),
    '~/components/layout/bs-page-header.vue': {},
    '~/components/modal-confirm.vue': {},
    '~/components/form/bs-select.vue': {},
    '../../../shared/access/roles.js': { CAPABILITIES },
  };
}

function mountPage(user) {
  return mountSfc('packages/ui/routes/connected-applications/index.vue', {
    mocks: {
      $t: (key, params = {}) => [key, ...Object.values(params)].join(' | '),
      $i18n: { locale: 'fr' },
    },
    imports: importsOf(user),
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
    ['en', en, /connection of “\{name\}” made on \{date\}.*other connections/],
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
      imports: importsOf({
        showSnackbar,
        apiRoutes: { connectedApplicationsItem: () => '/c1' },
      }),
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

// Whoever manages the platform connects in any company (ADR 0017): the page
// starts on the selected company, offers every other one and all of them, and
// says when the company it shows lets no assistant in.
const OPEN = { enableMcpModule: true, enableMcp: true };
const SELECTED = { id: 'g1', name: 'A client', ...OPEN };
const connectionIn = (id, group) => ({
  ...CONNECTION,
  id,
  group: { ...OPEN, ...group },
});
const IN_SELECTED = connectionIn('c1', SELECTED);
const IN_OTHER = connectionIn('c2', { id: 'g2', name: 'Another client' });

const rowsOf = (vm) => vm.shownApplications.map(({ id }) => id);
const noticeOf = (vm) => {
  const alert = vm.$el.querySelector('v-alert[type="info"]');
  return alert ? alert.textContent.trim() : null;
};

async function platformPage(applications, modulesGroup = SELECTED) {
  const vm = mountPage({ canManagePlatform: true, modulesGroup });
  vm.applications = applications;
  await settle(vm);
  return vm;
}

describe('the company filter', () => {
  it('starts on the selected company', async () => {
    const vm = await platformPage([IN_SELECTED, IN_OTHER]);

    expect(vm.$el.querySelector('bs-select')).not.toBeNull();
    expect(vm.groupFilter).toBe('g1');
    expect(rowsOf(vm)).toEqual(['c1']);
  });

  it('offers all the companies, then the selected one, then the others', async () => {
    const vm = await platformPage([IN_OTHER, IN_SELECTED]);

    expect(vm.groupItems).toEqual([
      { value: 'all', text: 'connectedApplications.allGroups' },
      { value: 'g1', text: 'A client' },
      { value: 'g2', text: 'Another client' },
    ]);
  });

  it('shows every connection for all the companies', async () => {
    const vm = await platformPage([IN_SELECTED, IN_OTHER]);

    vm.groupFilter = 'all';
    await settle(vm);

    expect(rowsOf(vm)).toEqual(['c1', 'c2']);
    expect(noticeOf(vm)).toBeNull();
  });

  it('is not offered to anyone else, whose connections are all shown', async () => {
    const vm = mountPage({ modulesGroup: SELECTED });
    vm.applications = [IN_SELECTED];
    await settle(vm);

    expect(vm.$el.querySelector('bs-select')).toBeNull();
    expect(rowsOf(vm)).toEqual(['c1']);
  });
});

describe('the company that lets no assistant in', () => {
  it('says the module is not active, from the store without a connection', async () => {
    const vm = await platformPage([IN_OTHER], {
      ...SELECTED,
      enableMcpModule: false,
    });

    expect(rowsOf(vm)).toEqual([]);
    expect(noticeOf(vm)).toBe('connectedApplications.noModule | A client');
  });

  it('says the access is off, for a company picked in the filter', async () => {
    const accessOff = connectionIn('c3', {
      id: 'g3',
      name: 'Third client',
      enableMcp: false,
    });
    const vm = await platformPage([IN_SELECTED, accessOff]);
    expect(noticeOf(vm)).toBeNull();

    vm.groupFilter = 'g3';
    await settle(vm);

    expect(noticeOf(vm)).toBe('connectedApplications.accessOff | Third client');
  });

  it('says it to anyone else, of their own company', async () => {
    const vm = mountPage({
      modulesGroup: { ...SELECTED, enableMcpModule: false },
    });
    await settle(vm);

    expect(noticeOf(vm)).toBe('connectedApplications.noModule | A client');
  });

  it('says nothing of a company whose flags did not load', async () => {
    const vm = mountPage({ modulesGroup: { id: 'g1', name: 'A client' } });
    await settle(vm);

    expect(noticeOf(vm)).toBeNull();
  });

  it.each([
    [
      'fr',
      fr,
      /module MCP.*\{group\}.*aucun assistant/,
      /accès MCP.*\{group\}/,
    ],
    ['en', en, /MCP module.*\{group\}.*no assistant/, /MCP access.*\{group\}/],
  ])('says it in %s', (_lang, messages, noModule, accessOff) => {
    expect(messages.connectedApplications.noModule).toMatch(noModule);
    expect(messages.connectedApplications.accessOff).toMatch(accessOff);
    expect(messages.connectedApplications.allGroups).toBeTruthy();
  });
});

// What the company's tech admin revokes at once are its connections (see
// "Connection" in GLOSSARY.md): one word for them, in every message of it.
describe.each([
  [
    'fr',
    fr,
    /connexion/i,
    /applications? connectées?|assistants IA connectés/i,
  ],
  ['en', en, /connection/i, /connected applications?|assistants? connected/i],
])(
  'the revocation of every connection in %s',
  (_lang, messages, term, other) => {
    it.each([
      'groupCount',
      'groupRevokeTitle',
      'groupRevokeConfirm',
      'groupCountError',
      'groupRevoked',
    ])('says connections in %s', (key) => {
      const text = messages.connectedApplications[key];

      text.split(' | ').forEach((form) => {
        expect(form).toMatch(term);
        expect(form).not.toMatch(other);
      });
    });
  }
);

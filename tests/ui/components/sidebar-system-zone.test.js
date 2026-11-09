/**
 * @jest-environment jsdom
 */
'use strict';

// The connected applications link of the sidebar (ADR 0017), mounted on the
// user store as the app fills it: `USER_SET` with the user the server sends,
// then `GET /groups/:id` for the user's own company. Whoever manages the
// platform always has the link, since the page lists their connections in
// every company; anyone else has it where their company has the MCP module
// and MCP access.

const Vue = require('vue');
const Vuex = require('vuex');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const userStore = require('~/store/user.js');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
  capabilitiesOfRole,
} = require('../../../packages/shared/access/roles.js');

Vue.use(Vuex);

// What Vuetify's tooltip does with its activator: it draws it.
Vue.component('VTooltip', {
  render(h) {
    return h('div', this.$scopedSlots.activator({ on: {} }));
  },
});

const COMPANY = { id: 'g1', name: 'Company A' };

// The user as the server sends it: its company by id and name, and for whoever
// manages the platform the selected company with its module flags.
function signedIn(role, flags) {
  const user = {
    id: 'u1',
    role,
    capabilities: capabilitiesOfRole(role),
    group: { ...COMPANY },
  };
  if (roleCan(role, CAPABILITIES.PLATFORM_MANAGE)) {
    user.selectedGroup = { ...COMPANY, ...flags };
  }
  return user;
}

async function mountSidebar(role, flags) {
  const store = new Vuex.Store({
    modules: { user: { namespaced: true, ...userStore } },
  });
  // The company as `GET /groups/:id` answers it.
  store.$axios = {
    $get: jest.fn().mockResolvedValue({ ...COMPANY, ...flags }),
  };
  await store.dispatch(
    `${userStore.USER}/${userStore.USER_SET}`,
    signedIn(role, flags)
  );
  const vm = mountSfc(
    'packages/ui/components/sidebar/bs-sidebar-system-zone.vue',
    {
      mocks: { $store: store, $t: (key) => key, $route: { path: '/' } },
      imports: {
        vuex: Vuex,
        'lucide-vue': {},
        './sidebar-config.js': require('../../../packages/ui/components/sidebar/sidebar-config.js'),
        '~/store/user': userStore,
        '~/helpers/module-activation.js': require('../../../packages/ui/helpers/module-activation.js'),
        '../../../shared/access/roles.js': require('../../../packages/shared/access/roles.js'),
      },
    }
  );
  await settle(vm);
  return { vm, store };
}

const hasLink = (vm) =>
  Boolean(
    vm.$el.querySelector('[aria-label="sidebar.system.connectedApplications"]')
  );

describe('the connected applications link', () => {
  it.each(Object.values(ROLES))(
    'is shown to a %s whose company has the module and the access',
    async (role) => {
      const { vm } = await mountSidebar(role, {
        enableMcpModule: true,
        enableMcp: true,
      });

      expect(hasLink(vm)).toBe(true);
    }
  );

  it.each(Object.values(ROLES))(
    'without the module, is shown to a %s only if they manage the platform',
    async (role) => {
      const { vm, store } = await mountSidebar(role, {
        enableMcpModule: false,
        enableMcp: true,
      });

      expect(store.$axios.$get).toHaveBeenCalledWith('/groups/g1');
      expect(hasLink(vm)).toBe(roleCan(role, CAPABILITIES.PLATFORM_MANAGE));
    }
  );

  it.each(Object.values(ROLES))(
    'without the access, is shown to a %s only if they manage the platform',
    async (role) => {
      const { vm } = await mountSidebar(role, {
        enableMcpModule: true,
        enableMcp: false,
      });

      expect(hasLink(vm)).toBe(roleCan(role, CAPABILITIES.PLATFORM_MANAGE));
    }
  );
});

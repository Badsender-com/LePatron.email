/**
 * @jest-environment jsdom
 */
'use strict';

// The MCP access of a company (ADR 0012), mounted: the address to give the
// users is copied through the helper that falls back on a browser without the
// clipboard API, and a copy that fails says so, the address left in its
// field to select.

const { mountSfc, componentOf, settle } = require('../../helpers/mount-sfc.js');
const Vue = require('vue');
const mixinGroupSwitch = require('../../../packages/ui/helpers/mixins/mixin-group-switch.js');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');

// What the i18n plugin gives every component, the steps among them.
Vue.prototype.$t = (key) => key;

// What Nuxt's link does: an anchor to its route.
Vue.component('NuxtLink', {
  props: { to: { type: String, default: '' } },
  render(h) {
    return h('a', { attrs: { href: this.to } }, this.$slots.default);
  },
});

const OPEN_GROUP = {
  id: 'g1',
  name: 'Company A',
  enableMcpModule: true,
  enableMcp: true,
};

function mountOption(copied, { group = OPEN_GROUP, role } = {}) {
  const commit = jest.fn();
  const copy = jest.fn().mockResolvedValue(copied);
  const can = (capability) => Boolean(role) && roleCan(role, capability);
  const vm = mountSfc('packages/ui/components/group/mcp-access-option.vue', {
    props: { group },
    mocks: {
      $t: (key) => key,
      $store: {
        commit,
        _modulesNamespaceMap: { 'page/': { context: { commit } } },
      },
    },
    imports: {
      vuex: { mapGetters: () => ({ can: () => can }) },
      'lucide-vue': {},
      '~/store/user': { CAN: 'can', USER: 'user' },
      '../../../shared/access/roles.js': { CAPABILITIES },
      '~/helpers/mixins/mixin-group-switch.js': mixinGroupSwitch,
      '~/helpers/copy-to-clipboard.js': { __esModule: true, default: copy },
      // Rendered, for the switch in its header.
      '~/components/layout/bs-form-section.vue': componentOf(
        'packages/ui/components/layout/bs-form-section.vue'
      ),
      '~/components/modal-confirm.vue': {},
      '~/components/layout/bs-settings-row.vue': {},
      '~/components/group/feature-switch.vue': {},
      '~/components/group/retex-option.vue': {},
      '~/components/group/connected-applications-option.vue': {},
      // Rendered, for the steps shown while the access is off.
      '~/components/group/mcp-access-steps.vue': componentOf(
        'packages/ui/components/group/mcp-access-steps.vue'
      ),
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

// Without the MCP module (ADR 0017), the section stays, its switch disabled
// and saying the module is not included. Whoever may open the module is sent
// to it; anyone else is told to ask the platform company.
describe('the MCP access of a company without the MCP module', () => {
  const closed = { ...OPEN_GROUP, enableMcpModule: false };

  it.each(Object.values(ROLES))('shows it to a %s', async (role) => {
    const { vm } = mountOption(true, { group: closed, role });
    await settle(vm);

    const toggle = vm.$el.querySelector('bs-group-feature-switch');
    const notice = vm.$el.querySelector(
      '.bs-group-mcp-access-option__no-module'
    );
    const opens = roleCan(role, CAPABILITIES.PLATFORM_MANAGE);

    expect(toggle.getAttribute('off-text')).toBe('mcpAccess.notIncluded');
    expect(toggle.hasAttribute('disabled')).toBe(true);
    expect(Boolean(notice.querySelector('a'))).toBe(opens);
    expect(notice.textContent).toContain(
      opens ? 'mcpAccess.moduleMissing' : 'mcpAccess.noModule'
    );
    expect(notice.textContent).not.toContain(
      opens ? 'mcpAccess.noModule' : 'mcpAccess.moduleMissing'
    );
  });

  it('sends whoever may open it to the Modules of the company', async () => {
    const { vm } = mountOption(true, {
      group: closed,
      role: ROLES.SUPER_ADMIN,
    });
    await settle(vm);

    expect(vm.$el.querySelector('a').getAttribute('href')).toBe(
      '/groups/g1/settings/general'
    );
  });

  it.each([
    ['fr', require('../../../packages/ui/helpers/locales/fr.js').default],
    ['en', require('../../../packages/ui/helpers/locales/en.js').default],
  ])('asks only the others to contact the platform company, in %s', (_l, m) => {
    expect(m.mcpAccess.noModule).toMatch(/plat(e)?form/);
    expect(m.mcpAccess.moduleMissing).toContain('{group}');
    expect(m.mcpAccess.moduleMissing).not.toMatch(/plat(e)?form/);
  });
});

// The section is a card (BsFormSection's card variant): its icon tile tinted
// while the access is on, grey when off. Off, it says in three steps what
// turning it on does, as a list even with its style reset.
describe('the MCP access of a company with the MCP module', () => {
  const off = { ...OPEN_GROUP, enableMcp: false };
  const section = (vm) => vm.$el.closest('.bs-form-section');

  it('is off: a grey card that lists the three steps', async () => {
    const { vm } = mountOption(true, { group: off });
    await settle(vm);

    const steps = vm.$el.querySelector('ol.bs-group-mcp-access-steps');
    const items = [...steps.querySelectorAll('li')];

    expect(section(vm).classList).toContain('bs-form-section--card');
    expect(section(vm).classList).toContain('bs-form-section--idle');
    expect(steps.getAttribute('role')).toBe('list');
    expect(
      items.map((li) => li.textContent.replace(/\s+/g, ' ').trim())
    ).toEqual(['1 mcpAccess.step1', '2 mcpAccess.step2', '3 mcpAccess.step3']);
    items.forEach((li) =>
      expect(li.querySelector('[aria-hidden="true"]')).not.toBeNull()
    );
    expect(copyButton(vm)).toBeUndefined();
  });

  it('is on: a tinted card that gives the address, without the steps', async () => {
    const { vm } = mountOption(true);
    await settle(vm);

    expect(section(vm).classList).toContain('bs-form-section--card');
    expect(section(vm).classList).not.toContain('bs-form-section--idle');
    expect(
      vm.$el.querySelector('.bs-form-section__content--flush')
    ).not.toBeNull();
    expect(vm.$el.querySelector('.bs-group-mcp-access-steps')).toBeNull();
    expect(
      vm.$el
        .querySelector('ul.bs-group-mcp-access-option__rows')
        .getAttribute('role')
    ).toBe('list');
    expect(copyButton(vm)).toBeDefined();
  });
});

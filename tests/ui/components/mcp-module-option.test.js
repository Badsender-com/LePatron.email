/**
 * @jest-environment jsdom
 */
'use strict';

// The MCP module's card in the company's Modules (ADR 0017), mounted. Its
// switch is saved with the form; closing a module that was open when the page
// loaded revokes the company's connections, so the save asks first, with
// their number.

const Vue = require('vue');
const { componentOf, settle } = require('../../helpers/mount-sfc.js');

const FILE = 'packages/ui/components/group/mcp-module-option.vue';

// What Vuetify's switch does: it shows `inputValue`, and its `change` carries
// the new value.
Vue.component('VSwitch', {
  props: { inputValue: Boolean },
  render(h) {
    return h('button', {
      class: 'v-switch-stub',
      attrs: { 'aria-checked': String(this.inputValue) },
      on: { click: () => this.$emit('change', !this.inputValue) },
    });
  },
});

// The design system's confirmation: `open` shows it, and the test answers it
// by the events the real one emits.
const BsModalConfirm = {
  name: 'BsModalConfirm',
  data: () => ({ shown: false }),
  methods: {
    open() {
      this.shown = true;
    },
  },
  render(h) {
    return h(
      'div',
      { class: 'modal-stub', attrs: { 'data-shown': String(this.shown) } },
      this.$slots.default
    );
  },
};

const translate = (key, params = {}) =>
  [key, ...Object.values(params)].join(' | ');

const mocksOf = ($get) => ({
  $t: translate,
  $tc: (key, count, params) => translate(key, params),
  $axios: { $get },
  $route: { path: '/groups/g1/settings/general' },
});

// A compiled component whose instances get the mocks, as `mountSfc` gives them.
const withMocks = (options, mocks) => ({
  ...options,
  beforeCreate() {
    Object.assign(this, mocks);
  },
});

const cardOf = (mocks) =>
  withMocks(
    componentOf(FILE, {
      'lucide-vue': {},
      '~/helpers/api-routes.js': {
        groupConnectedApplications: ({ groupId }) =>
          `/groups/${groupId}/connected-applications`,
      },
      '~/components/modal-confirm.vue': BsModalConfirm,
    }),
    mocks
  );

// The card inside a host that does what the form does: it applies the
// switch's `change` to the group, counts the saves, and hands a saved group
// over as a new object, as the page does.
function mountCard(group, $get = jest.fn().mockResolvedValue({ count: 2 })) {
  const Card = cardOf(mocksOf($get));
  const el = document.createElement('div');
  document.body.appendChild(el);
  const host = new Vue({
    data: () => ({
      group: { id: 'g1', name: 'Company A', ...group },
      saves: 0,
    }),
    render(h) {
      return h(Card, {
        ref: 'card',
        props: { group: this.group },
        on: {
          change: (value) => this.$set(this.group, 'enableMcpModule', value),
          save: () => {
            this.saves += 1;
          },
        },
      });
    },
  }).$mount(el);
  return { host, vm: host.$refs.card, $get };
}

const modalOf = (vm) => vm.$el.querySelector('.modal-stub');
const switchOf = (vm) => vm.$el.querySelector('.v-switch-stub');
// A click on the switch, as the user does it.
async function toggle(host) {
  switchOf(host.$refs.card).click();
  await settle(host);
}

describe('the save of the MCP module', () => {
  it('asks before closing a module that was open, with the count', async () => {
    const { host, vm, $get } = mountCard({ enableMcpModule: true });
    await toggle(host);

    await vm.requestSave();
    await settle(host);

    expect($get).toHaveBeenCalledWith('/groups/g1/connected-applications');
    expect(modalOf(vm).dataset.shown).toBe('true');
    expect(modalOf(vm).textContent).toContain(
      'groups.modules.mcp.closeConfirm | 2 | Company A'
    );
    expect(host.saves).toBe(0);

    vm.$refs.closeModal.$emit('confirm');
    expect(host.saves).toBe(1);
  });

  it('never asks about a module closed when the page loaded', async () => {
    const { host, vm, $get } = mountCard({ enableMcpModule: false });
    await toggle(host);
    await toggle(host);

    await vm.requestSave();

    expect($get).not.toHaveBeenCalled();
    expect(modalOf(vm).dataset.shown).toBe('false');
    expect(host.saves).toBe(1);
  });

  it('never asks while the module stays open', async () => {
    const { host, vm, $get } = mountCard({ enableMcpModule: true });

    await vm.requestSave();

    expect($get).not.toHaveBeenCalled();
    expect(host.saves).toBe(1);
  });

  it('still asks, without a number, when the count is unknown', async () => {
    const { host, vm } = mountCard(
      { enableMcpModule: true },
      jest.fn().mockRejectedValue(new Error('offline'))
    );
    await toggle(host);

    await vm.requestSave();
    await settle(host);

    expect(modalOf(vm).dataset.shown).toBe('true');
    expect(modalOf(vm).textContent).toContain(
      'groups.modules.mcp.closeConfirmUnknown | Company A'
    );
    expect(host.saves).toBe(0);
  });

  it('puts the switch back on when the closing is cancelled', async () => {
    const { host, vm } = mountCard({ enableMcpModule: true });
    await toggle(host);
    expect(switchOf(vm).getAttribute('aria-checked')).toBe('false');

    await vm.requestSave();
    vm.$refs.closeModal.$emit('cancel');
    await settle(host);

    expect(host.group.enableMcpModule).toBe(true);
    expect(switchOf(vm).getAttribute('aria-checked')).toBe('true');
    expect(host.saves).toBe(0);
  });

  it('saves at once when no connection is left to end', async () => {
    const { host, vm } = mountCard(
      { enableMcpModule: true },
      jest.fn().mockResolvedValue({ count: 0 })
    );
    await toggle(host);

    await vm.requestSave();
    await settle(host);

    expect(modalOf(vm).dataset.shown).toBe('false');
    expect(host.saves).toBe(1);
  });

  // Once saved closed, the page hands the saved company over: the module is
  // closed as loaded, and switching it on and off again ends nothing.
  it('measures from the company as saved', async () => {
    const { host, vm, $get } = mountCard({ enableMcpModule: true });
    await toggle(host);
    host.group = { id: 'g1', name: 'Company A', enableMcpModule: false };
    await settle(host);
    await toggle(host);
    await toggle(host);

    await vm.requestSave();

    expect($get).not.toHaveBeenCalled();
    expect(host.saves).toBe(1);
  });
});

// The card in the company's form: its switch is the group's, and the form's
// save goes through it.
describe('the MCP module in the company form', () => {
  function mountForm($get) {
    const mocks = mocksOf($get);
    const Form = withMocks(
      componentOf('packages/ui/components/group/form.vue', {
        vuelidate: require('vuelidate'),
        'vuelidate/lib/validators': require('vuelidate/lib/validators'),
        vuex: {
          mapGetters: () => ({ can: () => () => true }),
          mapMutations: () => ({ showSnackbar: jest.fn() }),
        },
        '~/helpers/api-routes.js': {},
        '~/store/user': { CAN: 'can', USER: 'user' },
        '~/store/page': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
        '~/helpers/constants/status': { Status: {} },
        '~/components/modal-confirm-form': {},
        '~/components/form/bs-text-field': {},
        '~/components/form/bs-textarea.vue': {},
        '~/components/form/bs-select': {},
        '~/components/layout/bs-form-section.vue': {},
        '~/components/group/mcp-module-option.vue': cardOf(mocks),
        '~/helpers/escape-html': { escapeHtml: (text) => text },
        'lucide-vue': {},
        '../../../shared/access/roles.js': {
          CAPABILITIES: { PLATFORM_MANAGE: 'platform.manage' },
        },
      }),
      mocks
    );
    const submitted = [];
    const el = document.createElement('div');
    document.body.appendChild(el);
    const host = new Vue({
      data: () => ({
        group: {
          id: 'g1',
          name: 'Company A',
          status: 'active',
          enableMcpModule: true,
        },
      }),
      render(h) {
        return h(Form, {
          ref: 'form',
          props: { group: this.group, isEdit: true },
          on: {
            update: (group) => {
              this.group = group;
            },
            submit: (group) => submitted.push({ ...group }),
          },
        });
      },
    }).$mount(el);
    return { host, form: host.$refs.form, submitted };
  }

  it('asks before a save that closes the module, then saves', async () => {
    const { host, form, submitted } = mountForm(
      jest.fn().mockResolvedValue({ count: 3 })
    );
    const card = form.$refs.mcpModule;
    switchOf(card).click();
    await settle(host);

    await form.onSubmit();
    await settle(host);

    expect(modalOf(card).dataset.shown).toBe('true');
    expect(submitted).toEqual([]);

    card.$refs.closeModal.$emit('confirm');

    expect(submitted).toHaveLength(1);
    expect(submitted[0].enableMcpModule).toBe(false);
  });
});

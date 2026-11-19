/**
 * @jest-environment jsdom
 */

'use strict';

// The two-factor row of a company's Security section (ADR 0008). Requiring it
// touches every member, so the change is confirmed first; it is saved on its
// own, and its outcome is read on the row. The counts load in the browser
// only: a server render would fetch every member for nothing.

const Vue = require('vue/dist/vue.common');
const { loadVueComponent } = require('../load-vue-component');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const GROUP = { id: 'group-1', requireTwoFactor: false };

function build({ canSwitch = true, put } = {}) {
  const options = loadVueComponent('components/group/two-factor-option.vue', {
    vuex: { mapGetters: () => ({ can: () => () => canSwitch }) },
  });
  const axios = {
    $get: jest.fn().mockResolvedValue({ items: [] }),
    $put:
      put || jest.fn().mockResolvedValue({ ...GROUP, requireTwoFactor: true }),
  };
  const Component = Vue.extend(options);
  const vm = new Component({
    propsData: { group: GROUP },
    render: (h) => h('div'),
    beforeCreate() {
      this.$axios = axios;
    },
  });
  return { vm, axios };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the two-factor row of the Security section', () => {
  it('loads the members once mounted, never on the server', async () => {
    const { vm, axios } = build();
    // Created without being mounted: what a server render does.
    expect(axios.$get).not.toHaveBeenCalled();

    vm.$mount();
    await flush();
    expect(axios.$get).toHaveBeenCalledTimes(1);
    vm.$destroy();
  });

  it('asks before saving, and a cancel draws the switch back', async () => {
    const { vm, axios } = build();
    const before = vm.switchKey;

    vm.ask(true);
    await vm.$nextTick();
    expect(vm.confirming).toBe(true);
    expect(vm.asked).toBe(true);

    // Closed without the action: Cancel, Escape or a click outside.
    vm.confirming = false;
    await vm.$nextTick();
    expect(vm.asked).toBe(null);
    expect(vm.switchKey).toBe(before + 1);
    expect(axios.$put).not.toHaveBeenCalled();
    expect(vm.outcome).toBe(null);
  });

  it('saves once confirmed, and says so on the row', async () => {
    const { vm, axios } = build();
    const updates = [];
    vm.$on('update', (group) => updates.push(group));

    vm.ask(true);
    vm.confirm();
    await vm.$nextTick();
    await flush();

    expect(axios.$put).toHaveBeenCalledWith(
      expect.stringContaining('group-1'),
      {
        requireTwoFactor: true,
      }
    );
    expect(updates).toEqual([{ ...GROUP, requireTwoFactor: true }]);
    expect(vm.outcome).toBe('saved');
    expect(vm.asked).toBe(null);
    vm.$destroy();
  });

  it('keeps the asked value after a failure, for "Réessayer"', async () => {
    const put = jest
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ ...GROUP, requireTwoFactor: true });
    const { vm } = build({ put });
    const before = vm.switchKey;

    vm.ask(true);
    vm.confirm();
    await vm.$nextTick();
    await flush();

    expect(vm.outcome).toBe('failed');
    expect(vm.asked).toBe(true);
    // The browser already flipped the switch: it is drawn back on the saved
    // state.
    expect(vm.switchKey).toBe(before + 1);

    // "Réessayer" asks again for the same value, then saves it.
    vm.ask(vm.asked);
    expect(vm.outcome).toBe(null);
    expect(vm.confirming).toBe(true);
    vm.confirm();
    await vm.$nextTick();
    await flush();
    expect(put).toHaveBeenLastCalledWith(expect.any(String), {
      requireTwoFactor: true,
    });
    expect(vm.outcome).toBe('saved');
    vm.$destroy();
  });

  it('cannot be switched without the tech capability', () => {
    expect(build({ canSwitch: false }).vm.canSwitch).toBe(false);
    expect(build({ canSwitch: true }).vm.canSwitch).toBe(true);
  });
});

'use strict';

// A switch of the company (two-factor authentication, MCP access) shows the
// value the server saved. Vuetify's switch keeps the state it was clicked
// to: after a failed save, the mixin has to put it back, or the page shows
// a value that was never saved.
//
// The mixin is a plain options object, exercised against a fake instance
// (the repository has no @vue/test-utils).
const mixinGroupSwitch = require('../../../packages/ui/helpers/mixins/mixin-group-switch')
  .default;

const GROUP_ID = '507f1f77bcf86cd799439001';

function makeVm(mixin, group, put) {
  const vm = {
    group,
    emitted: [],
    snackbars: [],
    $axios: { $put: put },
    $t: (key) => key,
    $emit(name, payload) {
      vm.emitted.push([name, payload]);
    },
  };
  Object.assign(vm, mixin.data.call(vm));
  Object.entries(mixin.methods).forEach(([name, fn]) => {
    vm[name] = fn.bind(vm);
  });
  vm.showSnackbar = (snackbar) => vm.snackbars.push(snackbar);
  return vm;
}

describe.each([
  ['enableMcp', 'mcpAccess.updated'],
  ['requireTwoFactor', 'twoFactor.group.updated'],
])('the %s switch', (field, updatedKey) => {
  const mixin = mixinGroupSwitch({ field, updatedKey });

  it('starts on the saved value', () => {
    expect(makeVm(mixin, { id: GROUP_ID, [field]: true }).switchValue).toBe(
      true
    );
    expect(makeVm(mixin, { id: GROUP_ID }).switchValue).toBe(false);
  });

  it('saves the field alone, then hands the group over', async () => {
    const saved = { id: GROUP_ID, [field]: true };
    const put = jest.fn().mockResolvedValue(saved);
    const vm = makeVm(mixin, { id: GROUP_ID, [field]: false }, put);

    await vm.save(true);

    expect(put).toHaveBeenCalledWith(`/groups/${GROUP_ID}`, { [field]: true });
    expect(vm.emitted).toEqual([['update', saved]]);
    expect(vm.switchValue).toBe(true);
    expect(vm.snackbars).toEqual([{ text: updatedKey, color: 'success' }]);
    expect(vm.loading).toBe(false);
  });

  it.each([
    [false, true],
    [true, false],
  ])('goes back to %p when turning it to %p fails', async (stored, clicked) => {
    const put = jest.fn().mockRejectedValue(new Error('500'));
    const vm = makeVm(mixin, { id: GROUP_ID, [field]: stored }, put);

    const saving = vm.save(clicked);
    expect(vm.switchValue).toBe(clicked);
    await saving;

    expect(vm.switchValue).toBe(stored);
    expect(vm.emitted).toEqual([]);
    expect(vm.snackbars).toEqual([
      { text: 'global.errors.errorOccured', color: 'error' },
    ]);
    expect(vm.loading).toBe(false);
  });

  it('follows the group when the page changes it', () => {
    const vm = makeVm(mixin, { id: GROUP_ID, [field]: false });

    mixin.watch[`group.${field}`].call(vm, true);

    expect(vm.switchValue).toBe(true);
  });
});

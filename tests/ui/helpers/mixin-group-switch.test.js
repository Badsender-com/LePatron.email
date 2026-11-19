'use strict';

// A switch of the company (two-factor authentication, MCP access, retex)
// shows the value the server saved. Vuetify's switch keeps the state it was
// clicked to: after a failed save, the mixin has to put it back, or the page
// shows a value that was never saved. The outcome is read beside the switch
// (mixinInlineOutcome), never in a toast.
//
// The mixin is a plain options object, exercised against a fake instance
// (the repository has no @vue/test-utils).
const mixinGroupSwitch = require('../../../packages/ui/helpers/mixins/mixin-group-switch')
  .default;

const GROUP_ID = '507f1f77bcf86cd799439001';

function makeVm(mixin, group, put) {
  const options = [...mixin.mixins, mixin];
  const vm = {
    group,
    emitted: [],
    $axios: { $put: put },
    $t: (key) => key,
    $emit(name, payload) {
      vm.emitted.push([name, payload]);
    },
  };
  options.forEach((option) => Object.assign(vm, option.data.call(vm)));
  options.forEach((option) =>
    Object.entries(option.methods).forEach(([name, fn]) => {
      vm[name] = fn.bind(vm);
    })
  );
  return vm;
}

describe.each(['enableMcp', 'requireTwoFactor', 'allowRetex'])(
  'the %s switch',
  (field) => {
    const mixin = mixinGroupSwitch({ field });

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('starts on the saved value', () => {
      expect(makeVm(mixin, { id: GROUP_ID, [field]: true }).switchValue).toBe(
        true
      );
      expect(makeVm(mixin, { id: GROUP_ID }).switchValue).toBe(false);
    });

    it('saves the field alone, hands the group over, and says so', async () => {
      const saved = { id: GROUP_ID, [field]: true };
      const put = jest.fn().mockResolvedValue(saved);
      const vm = makeVm(mixin, { id: GROUP_ID, [field]: false }, put);

      await expect(vm.save(true)).resolves.toBe(true);

      expect(put).toHaveBeenCalledWith(`/groups/${GROUP_ID}`, {
        [field]: true,
      });
      expect(vm.emitted).toEqual([['update', saved]]);
      expect(vm.switchValue).toBe(true);
      expect(vm.outcome).toBe('saved');
      expect(vm.loading).toBe(false);
    });

    it.each([
      [false, true],
      [true, false],
    ])(
      'goes back to %p when turning it to %p fails, and says so',
      async (stored, clicked) => {
        const put = jest.fn().mockRejectedValue(new Error('500'));
        const vm = makeVm(mixin, { id: GROUP_ID, [field]: stored }, put);

        const saving = vm.save(clicked);
        expect(vm.switchValue).toBe(clicked);
        await expect(saving).resolves.toBe(false);

        expect(vm.switchValue).toBe(stored);
        expect(vm.emitted).toEqual([]);
        expect(vm.outcome).toBe('failed');
        expect(vm.loading).toBe(false);
      }
    );

    it('clears a failure when the switch is tried again', async () => {
      const put = jest
        .fn()
        .mockRejectedValueOnce(new Error('500'))
        .mockReturnValueOnce(new Promise(() => {}));
      const vm = makeVm(mixin, { id: GROUP_ID, [field]: false }, put);

      await vm.save(true);
      expect(vm.outcome).toBe('failed');

      vm.save(!vm.switchValue);
      expect(vm.outcome).toBe(null);
      expect(put).toHaveBeenLastCalledWith(`/groups/${GROUP_ID}`, {
        [field]: true,
      });
    });

    it('follows the group when the page changes it', () => {
      const vm = makeVm(mixin, { id: GROUP_ID, [field]: false });

      mixin.watch[`group.${field}`].call(vm, true);

      expect(vm.switchValue).toBe(true);
    });
  }
);

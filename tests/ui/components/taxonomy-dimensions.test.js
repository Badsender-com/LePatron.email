'use strict';

// The writes on a dimension, from the taxonomy screen: one at a time, and a
// declared dimension placed after the last one (ADR-0032).

const { loadVueComponent } = require('../load-vue-component.js');

const component = loadVueComponent('components/group/taxonomy-dimensions.vue', {
  vuex: { mapMutations: () => ({}) },
});
const { request, saveDimension } = component.methods;

const screen = (dimensions = []) => {
  const vm = {
    dimensions,
    saving: false,
    groupId: 'company',
    showSnackbar: jest.fn(),
    $t: (key) => key,
    $axios: { $post: jest.fn(async () => ({})), $patch: jest.fn() },
    $refs: { formDialog: { close: jest.fn() } },
    fetchDimensions: jest.fn(async () => {}),
    reportError: jest.fn(),
  };
  vm.request = request.bind(vm);
  return vm;
};

describe('taxonomy dimensions: writes', () => {
  it('sends one write at a time, whatever the clicks', async () => {
    const vm = screen();
    let answer;
    const send = jest.fn(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );

    const first = vm.request(send, 'saved');
    const second = await vm.request(send, 'saved');
    answer();

    expect(second).toBe(false);
    await expect(first).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(vm.saving).toBe(false);
  });

  it('declares a dimension after the last one', async () => {
    const vm = screen([
      { name: 'emailType', order: 10 },
      { name: 'trigger', order: 20 },
      { name: 'market', order: 21 },
    ]);

    await saveDimension.call(vm, {
      id: null,
      payload: { name: 'brand', label: 'Marque' },
    });

    expect(vm.$axios.$post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: 'brand', order: 22 })
    );
  });
});

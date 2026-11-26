'use strict';

// A deactivated dimension takes no new value: the server refuses it, so the
// screen does not offer it, from the section header or the empty table.

const { loadVueComponent } = require('../load-vue-component.js');

const component = loadVueComponent('components/group/taxonomy-tab.vue', {
  vuex: { mapMutations: () => ({}) },
});
const { openCreateForm } = component.methods;

const tabWith = ({ canCreate }) => {
  const open = jest.fn();
  return {
    vm: { canCreate, items: [], $refs: { formDialog: { open } } },
    open,
  };
};

describe('taxonomy tab: creating a value', () => {
  it('opens the form on an active dimension', () => {
    const { vm, open } = tabWith({ canCreate: true });

    openCreateForm.call(vm);

    expect(open).toHaveBeenCalledWith(null, 0);
  });

  it('opens nothing on a deactivated dimension', () => {
    const { vm, open } = tabWith({ canCreate: false });

    openCreateForm.call(vm);

    expect(open).not.toHaveBeenCalled();
  });

  it('offers creation unless told otherwise', () => {
    expect(component.props.canCreate.default).toBe(true);
  });
});

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
    vm: {
      canCreate,
      items: [],
      fetchParentValues: jest.fn(async () => {}),
      $refs: { formDialog: { open } },
    },
    open,
  };
};

describe('taxonomy tab: creating a value', () => {
  it('opens the form on an active dimension', async () => {
    const { vm, open } = tabWith({ canCreate: true });

    await openCreateForm.call(vm);

    expect(open).toHaveBeenCalledWith(null, 0);
  });

  it('opens nothing on a deactivated dimension', async () => {
    const { vm, open } = tabWith({ canCreate: false });

    await openCreateForm.call(vm);

    expect(open).not.toHaveBeenCalled();
    expect(vm.fetchParentValues).not.toHaveBeenCalled();
  });

  it('offers creation unless told otherwise', () => {
    expect(component.props.canCreate.default).toBe(true);
  });
});

describe('taxonomy tab: the parent values', () => {
  const { fetchParentValues, openEditForm } = component.methods;

  const nestedTab = () => {
    let answer;
    const $get = jest.fn(
      () =>
        new Promise((resolve) => {
          answer = () => resolve({ items: [{ id: 'ca', label: 'Canada' }] });
        })
    );
    const vm = {
      parentName: 'market',
      groupId: 'group',
      parentValues: null,
      fetchingParentValues: false,
      reportError: jest.fn(),
      $axios: { $get },
      $refs: { formDialog: { open: jest.fn() } },
    };
    vm.fetchParentValues = fetchParentValues.bind(vm);
    return { vm, $get, answer: () => answer() };
  };

  it('are not read when the tab mounts, only when a form opens', () => {
    const fetchItems = jest.fn();
    const vm = { fetchItems, fetchParentValues: jest.fn() };

    component.mounted.call(vm);

    expect(fetchItems).toHaveBeenCalled();
    expect(vm.fetchParentValues).not.toHaveBeenCalled();
  });

  it('are read once for a double click, the form busy until they arrive', async () => {
    const { vm, $get, answer } = nestedTab();

    const first = openEditForm.call(vm, { id: 'fr' });
    const second = openEditForm.call(vm, { id: 'fr' });
    expect(vm.$refs.formDialog.open).toHaveBeenCalledWith({ id: 'fr' });
    expect(vm.fetchingParentValues).toBe(true);
    answer();
    await Promise.all([first, second]);

    expect($get).toHaveBeenCalledTimes(1);
    expect(vm.fetchingParentValues).toBe(false);
    expect(vm.parentValues).toEqual([{ id: 'ca', label: 'Canada' }]);
  });
});

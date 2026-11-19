/**
 * @jest-environment jsdom
 */

'use strict';

// The listing's filters panel (design system: FiltresPanel). "Réinitialiser"
// resets the whole search, the scope included; Escape empties the name only.
// Either one empties the field at once, even when the store has not yet
// learnt what was typed (the name reaches it 300 ms later).

const Vue = require('vue/dist/vue.common');
const { loadVueComponent } = require('../load-vue-component');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const EMPTY = {
  name: '',
  templates: [],
  createdAtStart: '',
  createdAtEnd: '',
  updatedAtStart: '',
  updatedAtEnd: '',
  tags: [],
};

function build({ query = {}, filters = {} } = {}) {
  const state = { filters: { ...EMPTY, ...filters }, workspacesHasRight: [] };
  const options = loadVueComponent(
    'routes/mailings/__partials/mailings-filters.vue',
    {
      vuex: {
        mapState: (_namespace, keys) =>
          Object.fromEntries(keys.map((key) => [key, () => state[key]])),
      },
    }
  );
  const store = {
    commit: jest.fn((_type, change) => Object.assign(state.filters, change)),
  };
  const router = { push: jest.fn() };
  const vm = new (Vue.extend(options))({
    render: (h) => h('div'),
    beforeCreate() {
      this.$store = store;
      this.$router = router;
      this.$route = { query };
    },
  });
  const refreshes = [];
  vm.$on('on-refresh', (payload) => refreshes.push(payload));
  return { vm, store, router, refreshes, state };
}

describe('the filters panel', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resets the filters and reloads the list in one location', () => {
    const { vm, store, router, refreshes } = build({
      query: { wid: 'w1' },
      filters: { tags: ['news'] },
    });
    vm.resetSearch();

    expect(store.commit).toHaveBeenCalledWith(expect.any(String), EMPTY);
    expect(refreshes).toEqual([{ pagination: { page: 1 } }]);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('leaves "all workspaces" through the route, which reloads the list', () => {
    const { vm, store, router, refreshes } = build({
      query: { scope: 'all', wid: 'w1' },
      filters: { tags: ['news'] },
    });
    vm.resetSearch();

    expect(store.commit).toHaveBeenCalledWith(expect.any(String), EMPTY);
    expect(router.push).toHaveBeenCalledWith({ query: { wid: 'w1' } });
    expect(refreshes).toEqual([]);
  });

  it('Escape empties a name typed less than 300 ms ago', () => {
    const { vm, state, refreshes } = build();
    vm.handleNameChange('newsletter');
    vm.clearName();

    expect(vm.nameInput).toBe('');
    // The typed name never reaches the store afterwards.
    jest.advanceTimersByTime(300);
    expect(state.filters.name).toBe('');
    expect(refreshes).toHaveLength(1);
  });

  it('"Réinitialiser" empties a name typed less than 300 ms ago', () => {
    const { vm, state } = build({ filters: { tags: ['news'] } });
    vm.handleNameChange('newsletter');
    vm.resetSearch();

    expect(vm.nameInput).toBe('');
    jest.advanceTimersByTime(300);
    expect(state.filters.name).toBe('');
  });

  it('a typed name reaches the store after 300 ms', () => {
    const { vm, state } = build();
    vm.handleNameChange('newsletter');
    expect(state.filters.name).toBe('');
    jest.advanceTimersByTime(300);
    expect(state.filters.name).toBe('newsletter');
  });
});

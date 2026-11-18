/**
 * @jest-environment jsdom
 */

'use strict';

// The bridge from Knockout to Vue that the right panels share (ADR 0020).

const ko = require('knockout');
const Vue = require('vue/dist/vue.common');
const koMirror = require('../../../packages/editor/src/js/vue/mixins/ko-mirror.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

function mount(setup) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return new Vue({
    mixins: [koMirror],
    data: () => ({ value: null }),
    created() {
      setup(this);
    },
    template: '<p>{{ value }}</p>',
  }).$mount(el);
}

describe('mirror', () => {
  it('reads the observable at once, then on each change', async () => {
    const source = ko.observable('a');
    const vm = mount((c) => c.mirror(source, (v) => (c.value = v)));
    expect(vm.value).toBe('a');
    source('b');
    await vm.$nextTick();
    expect(vm.$el.textContent).toBe('b');
  });

  it('calls onChange on notifications only, even for the same object', () => {
    const state = { step: 1 };
    const source = ko.observable(state);
    const onChange = jest.fn();
    const vm = mount((c) => c.mirror(source, (v) => (c.value = v), onChange));
    expect(onChange).not.toHaveBeenCalled();
    source(state);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(state);
    vm.$destroy();
  });

  it('stops listening when the component is destroyed', () => {
    const source = ko.observable(1);
    const vm = mount((c) => c.mirror(source, (v) => (c.value = v)));
    expect(source.getSubscriptionsCount()).toBe(1);
    vm.$destroy();
    expect(source.getSubscriptionsCount()).toBe(0);
    source(2);
    expect(vm.value).toBe(1);
  });

  it('ignores a call after the component went', () => {
    const source = ko.observable(1);
    const vm = mount(() => {});
    vm.$destroy();
    vm.mirror(source, (v) => (vm.value = v));
    expect(source.getSubscriptionsCount()).toBe(0);
  });

  it('reads a plain value once, and ignores a missing one', () => {
    const vm = mount((c) => {
      c.mirror(undefined, () => {
        throw new Error('never read');
      });
      c.mirror(
        () => 'fixed',
        (v) => (c.value = v)
      );
    });
    expect(vm.value).toBe('fixed');
  });
});

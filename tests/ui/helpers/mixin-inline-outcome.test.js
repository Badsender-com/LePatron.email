'use strict';

// The outcome of saving a setting, read where it was saved (`BsSaveOutcome`):
// "saved" for four seconds, "failed" until the next try, and no timer left
// behind by a page that is gone.

const Vue = require('vue/dist/vue.common');
const mixinInlineOutcome = require('../../../packages/ui/helpers/mixins/mixin-inline-outcome.js')
  .default;

Vue.config.productionTip = false;
Vue.config.devtools = false;

const build = () => new Vue({ mixins: [mixinInlineOutcome] });

describe('mixinInlineOutcome', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('says "saved" for four seconds', () => {
    const vm = build();
    vm.markSaved();
    expect(vm.outcome).toBe('saved');

    jest.advanceTimersByTime(3999);
    expect(vm.outcome).toBe('saved');
    jest.advanceTimersByTime(1);
    expect(vm.outcome).toBe(null);
  });

  it('keeps a failure, with its detail, until the next try', () => {
    const vm = build();
    vm.markFailed('Le serveur ne répond pas.');
    jest.advanceTimersByTime(60000);
    expect(vm.outcome).toBe('failed');
    expect(vm.outcomeDetail).toBe('Le serveur ne répond pas.');

    vm.clearOutcome();
    expect(vm.outcome).toBe(null);
    expect(vm.outcomeDetail).toBe('');
  });

  it('a failure after a save is not wiped by the save timer', () => {
    const vm = build();
    vm.markSaved();
    vm.markFailed();
    jest.advanceTimersByTime(4000);
    expect(vm.outcome).toBe('failed');
  });

  it('leaves no timer behind once destroyed', () => {
    const vm = build();
    vm.markSaved();
    expect(jest.getTimerCount()).toBe(1);
    vm.$destroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});

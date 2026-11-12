/**
 * @jest-environment jsdom
 */

'use strict';

// The pause on the AI's usage limit, counted down in the analysis's banner.

const Vue = require('vue/dist/vue.common');
const {
  pauseCountdown,
} = require('../../../packages/editor/src/js/vue/components/ai-panel/pause-countdown.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

function mount() {
  const state = Vue.observable({ pausedFor: null });
  const announced = [];
  const vm = new Vue({
    mixins: [pauseCountdown],
    data: () => ({ state }),
    methods: { t: (key, params) => `${key}:${params.seconds}` },
    render: (h) => h('div'),
  });
  vm.$on('announce', (message) => announced.push(message));
  vm.$mount();
  return { vm, state, announced };
}

afterEach(() => jest.useRealTimers());

describe('the pause countdown', () => {
  it('counts the seconds down, never to 0, and says the pause once', async () => {
    jest.useFakeTimers();
    const { vm, state, announced } = mount();
    state.pausedFor = 3;
    await Vue.nextTick();
    expect(vm.pauseLeft).toBe(3);
    jest.advanceTimersByTime(1000);
    expect(vm.pauseLeft).toBe(2);
    jest.advanceTimersByTime(5000);
    expect(vm.pauseLeft).toBe(1);
    expect(announced).toEqual(['ai-panel-correction-paused:3']);
  });

  it('stops once the session resumes, and when it goes', async () => {
    jest.useFakeTimers();
    const { vm, state } = mount();
    state.pausedFor = 5;
    await Vue.nextTick();
    state.pausedFor = null;
    await Vue.nextTick();
    expect(vm.pauseLeft).toBeNull();
    state.pausedFor = 5;
    await Vue.nextTick();
    vm.$destroy();
    expect(vm.pauseTimer).toBeNull();
  });
});

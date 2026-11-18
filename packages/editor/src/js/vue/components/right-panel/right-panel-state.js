'use strict';

const Vue = require('vue/dist/vue.common');

/**
 * The states of a right panel's body (ADR 0020, board v3-shell), the same in
 * the three panels: loading, empty at full size, empty and compact (under a
 * filter), and a loading error with « Réessayer ».
 */
const RightPanelState = Vue.component('RightPanelState', {
  props: {
    // 'loading' | 'empty' | 'compact' | 'error'
    kind: { type: String, required: true },
    // A lucide icon name, for the empty states.
    icon: { type: String, default: '' },
    title: { type: String, default: '' },
    text: { type: String, default: '' },
    // The error state's button, which emits `retry`.
    retryLabel: { type: String, default: '' },
  },
  template: `
    <div class="right-panel-state" :class="'right-panel-state--' + kind" :role="kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : null">
      <span v-if="kind === 'loading'" class="lucide lucide-loader right-panel-state__spinner" aria-hidden="true"></span>
      <span v-else-if="kind === 'error'" class="lucide lucide-alert-circle right-panel-state__icon" aria-hidden="true"></span>
      <span v-else-if="icon" :class="['lucide', icon, 'right-panel-state__icon']" aria-hidden="true"></span>
      <p v-if="title" class="right-panel-state__title">{{ title }}</p>
      <p v-if="text" class="right-panel-state__text">{{ text }}</p>
      <button v-if="kind === 'error' && retryLabel" type="button" class="qc-button qc-button--outline" @click="$emit('retry')">
        <span class="lucide lucide-refresh-cw" aria-hidden="true"></span>{{ retryLabel }}
      </button>
    </div>
  `,
});

module.exports = { RightPanelState };

'use strict';

const Vue = require('vue/dist/vue.common');

/**
 * The filter of the comments list (ADR 0020, decision 7): it only reads.
 * « Tous » and the block selected in the canvas, each with its count; with
 * no block selected, the second chip says so and cannot be chosen.
 */
const CommentsFilter = Vue.component('CommentsFilter', {
  props: {
    // The block id read, or null for all.
    filter: { type: String, default: null },
    allCount: { type: Number, default: 0 },
    // The block selected in the canvas: { id, label, count }, or null.
    block: { type: Object, default: null },
    t: { type: Function, required: true },
  },
  template: `
    <div class="comments-filter" role="group" :aria-label="t('comments-filter-label')">
      <button
        type="button"
        class="comments-filter__chip"
        :aria-pressed="filter === null ? 'true' : 'false'"
        @click="$emit('filter', null)"
      >{{ t('comments-filter-all') }} · {{ allCount }}</button>
      <button
        v-if="block"
        type="button"
        class="comments-filter__chip"
        :aria-pressed="filter === block.id ? 'true' : 'false'"
        @click="$emit('filter', block.id)"
      >
        <span class="lucide lucide-box" aria-hidden="true"></span>{{ block.label }} · {{ block.count }}
      </button>
      <span v-else class="comments-filter__chip comments-filter__chip--none">{{ t('comments-filter-no-block') }}</span>
    </div>
  `,
});

module.exports = { CommentsFilter };

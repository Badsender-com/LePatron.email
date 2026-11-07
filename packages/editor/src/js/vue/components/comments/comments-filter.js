'use strict';

const Vue = require('vue/dist/vue.common');

/**
 * The filter of the comments list (ADR 0020, decision 7): it only reads, and
 * says so under the chips while a block is read. « Tous » and a block, each
 * with its count: the block read, or else the block selected in the canvas;
 * with none, « Tous » alone (board c1).
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
      ><span v-if="filter === null" class="lucide lucide-check" aria-hidden="true"></span>{{ t('comments-filter-all') }} · {{ allCount }}</button>
      <button
        v-if="block"
        type="button"
        class="comments-filter__chip"
        :aria-pressed="filter === block.id ? 'true' : 'false'"
        @click="$emit('filter', block.id)"
      >
        <span :class="['lucide', filter === block.id ? 'lucide-check' : 'lucide-box']" aria-hidden="true"></span>{{ block.label }} · {{ block.count }}
      </button>
      <p v-if="filter && block && filter === block.id" class="comments-filter__note">{{ t('comments-filter-note', { block: block.label }) }}</p>
    </div>
  `,
});

module.exports = { CommentsFilter };

const Vue = require('vue/dist/vue.common');
const { QualityIssueRow } = require('./quality-issue-row');

// One group of the results list (a severity, or the ignored findings): a
// heading with a button that folds the rows, and the region it controls.
const QualityGroup = Vue.component('QualityGroup', {
  components: { QualityIssueRow },
  props: {
    // 'error', 'warning', …, or 'ignored'.
    id: { type: String, required: true },
    icon: { type: String, required: true },
    labelKey: { type: String, required: true },
    // Read with the count, for assistive technology: "4 errors".
    countKey: { type: String, required: true },
    items: { type: Array, default: () => [] },
    open: { type: Boolean, default: false },
    expandedId: { type: String, default: null },
    ignored: { type: Boolean, default: false },
    canComment: { type: Boolean, default: false },
    canIgnore: { type: Boolean, default: false },
    t: { type: Function, required: true },
  },
  computed: {
    toggleId() {
      return `qc-group-toggle-${this.id}`;
    },
    regionId() {
      return `qc-group-${this.id}`;
    },
  },
  template: `
    <div class="qc-group" :class="'qc-group--' + id">
      <h3 class="qc-group__header">
        <button
          type="button"
          class="qc-group__toggle"
          :id="toggleId"
          :aria-expanded="open ? 'true' : 'false'"
          :aria-controls="regionId"
          @click="$emit('toggle-open')"
        >
          <span :class="['lucide', icon, 'qc-sev--' + id]" aria-hidden="true"></span>
          <span class="qc-group__label">{{ t(labelKey) }}</span>
          <span class="qc-group__count" aria-hidden="true">{{ items.length }}</span>
          <span class="qc-sr-only">{{ t(countKey, { count: items.length }) }}</span>
          <span :class="['lucide', open ? 'lucide-chevron-up' : 'lucide-chevron-down']" aria-hidden="true"></span>
        </button>
      </h3>
      <div v-if="open" :id="regionId" role="region" :aria-labelledby="toggleId">
        <quality-issue-row
          v-for="item in items"
          :key="item.id"
          :item="item"
          :t="t"
          :ignored="ignored"
          :can-comment="canComment"
          :can-ignore="canIgnore"
          :expanded="expandedId === item.id"
          @toggle="$emit('toggle', item)"
          @locate="$emit('locate', item)"
          @comment="$emit('comment', item)"
          @ignore="$emit('ignore', item)"
          @unignore="$emit('unignore', item)"
        ></quality-issue-row>
      </div>
    </div>
  `,
});

module.exports = { QualityGroup };

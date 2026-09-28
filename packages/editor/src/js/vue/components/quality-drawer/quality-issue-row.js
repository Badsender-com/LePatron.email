const Vue = require('vue/dist/vue.common');
const { SEVERITY_META } = require('./quality-meta');

// One result of the quality drawer: collapsed to a line, expanded inline to its
// full description and its three actions (the mock-up's: go to block, add a
// comment, ignore). Everything it prints is interpolated as text: a
// description may quote the email's own content (a link label).
const QualityIssueRow = Vue.component('QualityIssueRow', {
  props: {
    item: { type: Object, required: true },
    expanded: { type: Boolean, default: false },
    // Ignored by the team: shown muted, with "Stop ignoring" instead.
    ignored: { type: Boolean, default: false },
    canComment: { type: Boolean, default: false },
    t: { type: Function, required: true },
  },
  computed: {
    meta() {
      return SEVERITY_META[this.item.severity];
    },
    panelId() {
      return `qc-row-${this.item.id.replace(/[^\w-]/g, '_')}`;
    },
    // Passed checks have nothing to act on.
    isFinding() {
      return Boolean(this.item.finding);
    },
  },
  template: `
    <div class="qc-row" :class="{ 'qc-row--expanded': expanded, 'qc-row--ignored': ignored }">
      <button
        type="button"
        class="qc-row__head"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="panelId"
        @click="$emit('toggle')"
      >
        <span
          :class="['lucide', meta.icon, 'qc-row__icon', 'qc-sev--' + item.severity]"
          aria-hidden="true"
        ></span>
        <span class="qc-sr-only">{{ t(meta.labelKey) }}</span>
        <span class="qc-row__main">
          <span class="qc-row__line">
            <span class="qc-row__title">{{ item.title }}</span>
            <span v-if="item.blockLabel" class="qc-row__block">· {{ item.blockLabel }}</span>
          </span>
          <span v-if="!expanded" class="qc-row__desc">{{ item.description }}</span>
        </span>
        <span class="qc-row__category">{{ item.category }}</span>
        <span
          :class="['lucide', expanded ? 'lucide-chevron-up' : 'lucide-chevron-down', 'qc-row__chevron']"
          aria-hidden="true"
        ></span>
      </button>
      <div v-if="expanded" :id="panelId" class="qc-row__panel">
        <p class="qc-row__full">{{ item.description }}</p>
        <div v-if="isFinding" class="qc-row__actions">
          <button v-if="item.blockId" type="button" class="qc-button qc-button--outline qc-button--sm" @click="$emit('locate')">
            <span class="lucide lucide-arrow-right" aria-hidden="true"></span>
            {{ t('Go to block') }}
          </button>
          <button v-if="canComment" type="button" class="qc-button qc-button--ghost qc-button--sm" @click="$emit('comment')">
            <span class="lucide lucide-message-circle" aria-hidden="true"></span>
            {{ t('Add comment') }}
          </button>
          <button v-if="!ignored" type="button" class="qc-button qc-button--ghost qc-button--sm" @click="$emit('ignore')">
            <span class="lucide lucide-ban" aria-hidden="true"></span>
            {{ t('Ignore') }}
          </button>
          <button v-else type="button" class="qc-button qc-button--ghost qc-button--sm" @click="$emit('unignore')">
            <span class="lucide lucide-refresh-cw" aria-hidden="true"></span>
            {{ t('Stop ignoring') }}
          </button>
        </div>
      </div>
    </div>
  `,
});

module.exports = { QualityIssueRow };

'use strict';

const Vue = require('vue/dist/vue.common');
const { CommentsMenu } = require('./comments-menu');
const { MentionTextarea } = require('./mention-textarea');

let uid = 0;

const CATEGORIES = [
  ['general', 'lucide-message-circle'],
  ['design', 'lucide-brush'],
  ['content', 'lucide-file-text'],
];
const SEVERITIES = [
  ['info', 'lucide-info'],
  ['important', 'lucide-triangle-alert'],
  ['blocking', 'lucide-alert-circle'],
];

/**
 * The comment form, in the panel's foot (ADR 0020, boards v3-comments-c1 to
 * c5): the text, with mentions; « Sur », the explicit target (decision 7),
 * the whole email or the block selected, which it follows until changed;
 * « Type » and « Priorité »; « Ajouter », and « Approuver l'email » for whom
 * may approve, disabled with its reason while a blocking comment is open.
 *
 * It holds nothing: the draft is the comments' store's, and each choice an
 * event the panel carries out.
 */
const CommentComposer = Vue.component('CommentComposer', {
  components: { CommentsMenu, MentionTextarea },
  props: {
    text: { type: String, default: '' },
    users: { type: Array, default: () => [] },
    // The block id of the new comment, or null for the whole email.
    target: { type: String, default: null },
    // The block selected in the canvas: { id, label }, or null.
    selected: { type: Object, default: null },
    // The label of a block by its id: the target may be a block no longer
    // selected (from the quality control).
    labelOf: { type: Function, required: true },
    category: { type: String, default: 'general' },
    severity: { type: String, default: 'info' },
    canApprove: { type: Boolean, default: false },
    approveBlocked: { type: Boolean, default: false },
    // A comment or an approval on its way: no second one by a double click.
    // The panel sets it as it receives `submit` or `approve`, before waiting.
    busy: { type: Boolean, default: false },
    t: { type: Function, required: true },
  },
  created() {
    uid += 1;
    // Kept focusable while disabled, so that its reason is read from it.
    this.reasonId = `comments-approve-blocked-${uid}`;
  },
  computed: {
    targets() {
      const options = [
        {
          value: null,
          label: this.t('comments-whole-email'),
          hint: this.t('comments-context-global'),
          icon: 'lucide-mail',
        },
      ];
      const blockOption = (id, hintKey) => ({
        value: id,
        label: this.labelOf(id),
        hint: this.t(hintKey),
        icon: 'lucide-box',
      });
      if (this.selected) {
        options.push({
          ...blockOption(this.selected.id, 'comments-target-selected'),
          label: this.selected.label || this.labelOf(this.selected.id),
        });
      }
      if (this.target && (!this.selected || this.selected.id !== this.target)) {
        options.push(blockOption(this.target, 'comments-target-chosen'));
      }
      return options;
    },
    categories() {
      return CATEGORIES.map(([value, icon]) => ({
        value,
        icon,
        label: this.t(`comments-category-${value}`),
      }));
    },
    severities() {
      return SEVERITIES.map(([value, icon]) => ({
        value,
        icon,
        label: this.t(`comments-severity-${value}`),
      }));
    },
  },
  methods: {
    focus() {
      this.$refs.text.focus();
    },
  },
  template: `
    <form class="comment-composer" :aria-busy="busy ? 'true' : 'false'" @submit.prevent="busy || !text.trim() || $emit('submit')">
      <mention-textarea
        ref="text"
        :value="text"
        :users="users"
        :label="t('comments-placeholder')"
        :placeholder="t('comments-placeholder')"
        :t="t"
        @input="$emit('input', $event)"
        @mention="$emit('mention', $event)"
      ></mention-textarea>
      <comments-menu
        class="comment-composer__target"
        :label="t('comments-target')"
        :value="target"
        :options="targets"
        :note="t('comments-target-note')"
        @input="$emit('target', $event)"
      ></comments-menu>
      <div class="comment-composer__row">
        <comments-menu :label="t('comments-type')" :value="category" :options="categories" @input="$emit('category', $event)"></comments-menu>
        <comments-menu :label="t('comments-priority')" :value="severity" :options="severities" @input="$emit('severity', $event)"></comments-menu>
        <!-- Who may not approve adds on this line (board c1); who may, below. -->
        <button v-if="!canApprove" type="submit" class="qc-button qc-button--cta comment-composer__add" :disabled="busy || !text.trim()">{{ t('comments-add') }}</button>
      </div>
      <!-- Who may approve: below a rule across the foot (boards c3, c5). -->
      <div v-if="canApprove" class="comment-composer__approval">
      <p v-if="approveBlocked" :id="reasonId" class="comment-composer__blocked">
        <span class="lucide lucide-alert-circle" aria-hidden="true"></span>{{ t('comments-approve-blocked') }}
      </p>
      <div class="comment-composer__actions">
        <button
          type="button"
          class="qc-button qc-button--outline comment-composer__approve"
          :aria-disabled="approveBlocked || busy ? 'true' : 'false'"
          :aria-describedby="approveBlocked ? reasonId : null"
          @click="approveBlocked || busy || $emit('approve')"
        >
          <span class="lucide lucide-check-check" aria-hidden="true"></span>{{ t('comments-approve-email') }}
        </button>
        <button type="submit" class="qc-button qc-button--cta" :disabled="busy || !text.trim()">{{ t('comments-add') }}</button>
      </div>
      </div>
    </form>
  `,
});

module.exports = { CommentComposer };

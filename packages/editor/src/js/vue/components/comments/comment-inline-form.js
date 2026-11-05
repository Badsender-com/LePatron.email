'use strict';

const Vue = require('vue/dist/vue.common');
const { MentionTextarea } = require('./mention-textarea');

/**
 * Writing in the thread (ADR 0020): a reply under its comment, or a comment
 * being edited in its place. The text, with mentions; « Annuler » and the
 * action. Escape cancels; the panel stays open.
 */
const CommentInlineForm = Vue.component('CommentInlineForm', {
  components: { MentionTextarea },
  props: {
    text: { type: String, default: '' },
    users: { type: Array, default: () => [] },
    label: { type: String, required: true },
    submitLabel: { type: String, required: true },
    busy: { type: Boolean, default: false },
    t: { type: Function, required: true },
  },
  mounted() {
    this.$refs.text.focus();
  },
  methods: {
    onKey(event) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.stopPropagation();
      this.$emit('cancel');
    },
  },
  template: `
    <form class="comment-inline-form" @submit.prevent="busy || $emit('submit')" @keydown="onKey">
      <mention-textarea
        ref="text"
        :rows="2"
        :value="text"
        :users="users"
        :label="label"
        :placeholder="t('comments-placeholder')"
        @input="$emit('input', $event)"
        @mention="$emit('mention', $event)"
      ></mention-textarea>
      <div class="comment-inline-form__actions">
        <button type="button" class="qc-button qc-button--ghost qc-button--sm" @click="$emit('cancel')">{{ t('comments-cancel') }}</button>
        <button type="submit" class="qc-button qc-button--cta qc-button--sm" :disabled="busy">{{ submitLabel }}</button>
      </div>
    </form>
  `,
});

module.exports = { CommentInlineForm };

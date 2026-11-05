'use strict';

const Vue = require('vue/dist/vue.common');
const { CommentText } = require('./comment-text');
const { authorOf } = require('../../../ext/comments/comments-thread');

const CATEGORY_ICONS = {
  general: 'lucide-message-circle',
  design: 'lucide-brush',
  content: 'lucide-file-text',
};

/**
 * A comment of the panel and its replies (ADR 0020, board v3-comments-c1):
 * who and when, its priority while open, its type, what it is on (a block,
 * with « Aller au bloc », or the whole email), its text, then the actions the
 * user may take. A resolved comment shows folded until opened.
 *
 * It only asks: each action is an event the panel carries out. The slot below
 * the replies holds the reply being written (the panel's form).
 */
const CommentItem = Vue.component('CommentItem', {
  components: { CommentText },
  props: {
    comment: { type: Object, required: true },
    replies: { type: Array, default: () => [] },
    t: { type: Function, required: true },
    formatDate: { type: Function, required: true },
    // The label of a block by its id, and whether it is still in the email.
    labelOf: { type: Function, required: true },
    blockExists: { type: Function, required: true },
    // What the user may do with a comment: can('edit' | 'delete', comment).
    can: { type: Function, required: true },
  },
  data: () => ({ unfolded: false }),
  computed: {
    folded() {
      return this.comment.resolved && !this.unfolded;
    },
    author() {
      return authorOf(this.comment) || this.t('comments-anonymous');
    },
    categoryIcon() {
      return CATEGORY_ICONS[this.comment.category] || CATEGORY_ICONS.general;
    },
    category() {
      return this.t(`comments-category-${this.comment.category || 'general'}`);
    },
    // An open comment shows its priority when it is more than an info.
    severity() {
      const { severity, resolved } = this.comment;
      return !resolved && severity && severity !== 'info' ? severity : null;
    },
    onBlock() {
      return Boolean(this.comment.blockId);
    },
  },
  methods: {
    authorOf(reply) {
      return authorOf(reply) || this.t('comments-anonymous');
    },
  },
  template: `
    <article class="comment-item" :class="{ 'comment-item--resolved': comment.resolved }" tabindex="-1" :data-comment-id="comment._id">
      <header class="comment-item__head">
        <span class="comment-item__author">{{ author }}</span>
        <span class="comment-item__date">{{ formatDate(comment.createdAt) }}</span>
        <span v-if="severity" class="comment-badge" :class="'comment-badge--' + severity">
          <span :class="['lucide', severity === 'blocking' ? 'lucide-alert-circle' : 'lucide-triangle-alert']" aria-hidden="true"></span>{{ t('comments-severity-' + severity) }}
        </span>
        <span v-if="comment.resolved" class="comment-badge comment-badge--resolved">
          <span class="lucide lucide-check" aria-hidden="true"></span>{{ t('comments-resolved-badge') }}
        </span>
        <span class="comment-item__category">
          <span :class="['lucide', categoryIcon]" aria-hidden="true"></span>{{ category }}
        </span>
        <button
          v-if="comment.resolved"
          type="button"
          class="qc-icon-button comment-item__fold"
          :aria-expanded="folded ? 'false' : 'true'"
          :aria-label="t(folded ? 'comments-unfold' : 'comments-fold')"
          @click="unfolded = !unfolded"
        >
          <span :class="['lucide', folded ? 'lucide-chevron-down' : 'lucide-chevron-up']" aria-hidden="true"></span>
        </button>
      </header>

      <template v-if="!folded">
        <p class="comment-item__target">
          <template v-if="onBlock">
            <span class="lucide lucide-box" aria-hidden="true"></span>
            <span>{{ labelOf(comment.blockId) }}</span>
            <template v-if="blockExists(comment.blockId)">
              <span aria-hidden="true">·</span>
              <button type="button" class="qc-link-button comment-item__go" @click="$emit('go-to-block', comment)">{{ t('comments-go-to-block') }}</button>
            </template>
            <span v-else class="comment-item__gone">· {{ t('comments-block-deleted') }}</span>
          </template>
          <template v-else>
            <span class="lucide lucide-mail" aria-hidden="true"></span>
            <span>{{ t('comments-whole-email') }}</span>
          </template>
        </p>

        <slot name="body">
          <comment-text :text="comment.text"></comment-text>
        </slot>

        <ul v-if="replies.length" class="comment-item__replies">
          <li v-for="reply in replies" :key="reply._id" class="comment-reply">
            <p class="comment-reply__head">
              <span class="comment-item__author">{{ authorOf(reply) }}</span>
              <span class="comment-item__date">{{ formatDate(reply.createdAt) }}</span>
              <button v-if="can('delete', reply)" type="button" class="qc-icon-button comment-reply__delete" :aria-label="t('comments-delete')" :title="t('comments-delete')" @click="$emit('delete', reply)">
                <span class="lucide lucide-trash-2" aria-hidden="true"></span>
              </button>
            </p>
            <comment-text :text="reply.text"></comment-text>
          </li>
        </ul>

        <slot></slot>

        <div class="comment-item__actions">
          <template v-if="!comment.resolved">
            <button type="button" class="qc-icon-button" :aria-label="t('comments-reply')" :title="t('comments-reply')" @click="$emit('reply', comment)">
              <span class="lucide lucide-reply" aria-hidden="true"></span>
            </button>
            <button type="button" class="qc-icon-button" :aria-label="t('comments-resolve')" :title="t('comments-resolve')" @click="$emit('resolve', comment)">
              <span class="lucide lucide-check" aria-hidden="true"></span>
            </button>
          </template>
          <button v-else type="button" class="qc-icon-button" :aria-label="t('comments-unresolve')" :title="t('comments-unresolve')" @click="$emit('unresolve', comment)">
            <span class="lucide lucide-rotate-ccw" aria-hidden="true"></span>
          </button>
          <button v-if="can('edit', comment)" type="button" class="qc-icon-button" :aria-label="t('comments-edit')" :title="t('comments-edit')" @click="$emit('edit', comment)">
            <span class="lucide lucide-pencil" aria-hidden="true"></span>
          </button>
          <button v-if="can('delete', comment)" type="button" class="qc-icon-button" :aria-label="t('comments-delete')" :title="t('comments-delete')" @click="$emit('delete', comment)">
            <span class="lucide lucide-trash-2" aria-hidden="true"></span>
          </button>
        </div>
      </template>
    </article>
  `,
});

module.exports = { CommentItem };

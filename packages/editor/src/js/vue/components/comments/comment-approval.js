'use strict';

const Vue = require('vue/dist/vue.common');
const { CommentText } = require('./comment-text');
const { authorOf } = require('../../../ext/comments/comments-thread');

/**
 * An approval in the thread (ADR 0020, boards v3-comments-c4 and c6): an
 * event, not a comment to resolve. « X a approuvé l'email », its text, and
 * « Retirer l'approbation » for its author or a moderator of the comments.
 * When it no longer holds, it says why: the comment that lifted it, or a
 * blocking comment open since.
 */
const CommentApproval = Vue.component('CommentApproval', {
  components: { CommentText },
  props: {
    approval: { type: Object, required: true },
    // { by: name } or { blocking: true } when it no longer holds, or null.
    lifted: { type: Object, default: null },
    canWithdraw: { type: Boolean, default: false },
    // Replies written under the approval before it became an event.
    replies: { type: Array, default: () => [] },
    t: { type: Function, required: true },
    formatDate: { type: Function, required: true },
  },
  computed: {
    author() {
      return this.authorOf(this.approval);
    },
  },
  methods: {
    authorOf(comment) {
      return authorOf(comment) || this.t('comments-anonymous');
    },
  },
  template: `
    <article class="comment-approval" :class="{ 'comment-approval--lifted': lifted }" tabindex="-1" :data-comment-id="approval._id">
      <span class="comment-approval__mark" aria-hidden="true"><span class="lucide lucide-check-check"></span></span>
      <div class="comment-approval__body">
        <p class="comment-approval__head">
          <strong class="comment-approval__name">{{ author }}</strong> {{ t('comments-approved-the-email') }}
          <span class="comment-item__date"> · {{ formatDate(approval.createdAt) }}</span>
        </p>
        <p v-if="lifted" class="comment-approval__lifted" role="note">
          <span class="lucide lucide-triangle-alert" aria-hidden="true"></span>
          <span v-if="lifted.blocking">{{ t('comments-approval-held') }}</span>
          <span v-else>{{ t('comments-approval-lifted', { name: lifted.by || t('comments-anonymous') }) }}</span>
        </p>
        <comment-text v-else class="comment-approval__text" :text="approval.text"></comment-text>
        <ul v-if="replies.length" class="comment-item__replies">
          <li v-for="reply in replies" :key="reply._id" class="comment-reply">
            <p class="comment-reply__head">
              <span class="comment-item__author">{{ authorOf(reply) }}</span>
              <span class="comment-item__date">{{ formatDate(reply.createdAt) }}</span>
            </p>
            <comment-text :text="reply.text"></comment-text>
          </li>
        </ul>
        <button v-if="canWithdraw" type="button" class="qc-link-button comment-approval__withdraw" @click="$emit('withdraw', approval)">{{ t('comments-withdraw-approval') }}</button>
      </div>
    </article>
  `,
});

module.exports = { CommentApproval };

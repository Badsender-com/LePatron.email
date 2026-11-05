'use strict';

const Vue = require('vue/dist/vue.common');
const { CommentItem } = require('./comment-item');
const { CommentApproval } = require('./comment-approval');
const { RightPanelState } = require('../right-panel/right-panel-state');
const {
  threadOf,
  approvalOf,
  isApproval,
} = require('../../../ext/comments/comments-thread');

/**
 * The comments list (ADR 0020): the new comments held behind a pill, the
 * thread newest first, the approvals as events, the resolved comments folded
 * under their count; and the states of the shell while it loads, when it is
 * empty, or when it could not load.
 *
 * It only shows and asks: every action is an event the panel carries out.
 * The comment being edited and the reply being written are the panel's,
 * given through the `edit` and `reply` slots.
 */
const CommentsList = Vue.component('CommentsList', {
  components: { CommentItem, CommentApproval, RightPanelState },
  props: {
    comments: { type: Array, default: () => [] },
    // The block id read, or null for all.
    filter: { type: String, default: null },
    // The store's status: false, 'loading', 'error', or the count loaded.
    status: { type: [Boolean, String, Number], default: false },
    pendingCount: { type: Number, default: 0 },
    editingId: { type: String, default: null },
    replyingId: { type: String, default: null },
    t: { type: Function, required: true },
    formatDate: { type: Function, required: true },
    labelOf: { type: Function, required: true },
    blockExists: { type: Function, required: true },
    // can('edit' | 'delete', comment)
    can: { type: Function, required: true },
  },
  data: () => ({ showResolved: false }),
  computed: {
    thread() {
      return threadOf(this.comments, this.filter);
    },
    approval() {
      return approvalOf(this.comments);
    },
    loading() {
      return this.status === 'loading';
    },
    empty() {
      return (
        !this.loading &&
        this.status !== 'error' &&
        !this.thread.items.length &&
        !this.thread.resolved.length &&
        !this.pendingCount
      );
    },
  },
  methods: {
    isApproval,
  },
  template: `
    <div class="comments-list">
      <right-panel-state v-if="loading" kind="loading" :text="t('comments-loading')"></right-panel-state>
      <right-panel-state
        v-else-if="status === 'error'"
        kind="error"
        :title="t('comments-load-error')"
        :retry-label="t('comments-retry')"
        @retry="$emit('retry')"
      ></right-panel-state>

      <template v-else>
        <div class="comments-list__pill" aria-live="polite">
          <button v-if="pendingCount" type="button" class="comments-new-pill" @click="$emit('show-new')">
            {{ t(pendingCount === 1 ? 'comments-new-one' : 'comments-new', { count: pendingCount }) }}
          </button>
        </div>

        <template v-if="empty">
          <right-panel-state v-if="filter" kind="compact" icon="lucide-box" :text="t('comments-empty-block')"></right-panel-state>
          <right-panel-state v-else kind="empty" icon="lucide-message-square" :title="t('comments-empty')" :text="t('comments-empty-text')"></right-panel-state>
        </template>

        <template v-for="item in thread.items">
          <comment-approval
            v-if="isApproval(item)"
            :key="item._id"
            :approval="item"
            :lifted="approval.liftedBy[item._id] || null"
            :can-withdraw="can('delete', item)"
            :t="t"
            :format-date="formatDate"
            @withdraw="$emit('delete', $event)"
          ></comment-approval>
          <comment-item
            v-else
            :key="item._id"
            :comment="item"
            :replies="thread.repliesOf(item._id)"
            :t="t"
            :format-date="formatDate"
            :label-of="labelOf"
            :block-exists="blockExists"
            :can="can"
            v-on="$listeners"
          >
            <template v-if="editingId === item._id" v-slot:body>
              <slot name="edit" :comment="item"></slot>
            </template>
            <slot v-if="replyingId === item._id" name="reply" :comment="item"></slot>
          </comment-item>
        </template>

        <section v-if="thread.resolved.length" class="comments-list__resolved">
          <button type="button" class="comments-list__resolved-toggle" :aria-expanded="showResolved ? 'true' : 'false'" @click="showResolved = !showResolved">
            <span :class="['lucide', showResolved ? 'lucide-chevron-down' : 'lucide-chevron-right']" aria-hidden="true"></span>
            {{ t(thread.resolved.length === 1 ? 'comments-resolved-count-one' : 'comments-resolved-count', { count: thread.resolved.length }) }}
          </button>
          <template v-if="showResolved">
            <comment-item
              v-for="item in thread.resolved"
              :key="item._id"
              :comment="item"
              :replies="thread.repliesOf(item._id)"
              :t="t"
              :format-date="formatDate"
              :label-of="labelOf"
              :block-exists="blockExists"
              :can="can"
              v-on="$listeners"
            ></comment-item>
          </template>
        </section>
      </template>
    </div>
  `,
});

module.exports = { CommentsList };

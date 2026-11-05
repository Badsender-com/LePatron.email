'use strict';

/**
 * Markup of the comments panel (ADR 0020), kept out of the component: the
 * shell, its count or « Validé », the filter in its nav, the list in its body
 * and the form in its foot.
 */

module.exports = `
<right-panel-shell
  ref="shell"
  class="comments-panel"
  title-id="comments-panel-title"
  :title="t('comments-title')"
  :close-label="t('right-panel-close')"
  :count="approved || !unresolved ? null : unresolved"
  :count-label="countLabel"
  @close="close"
>
  <template v-if="approved" v-slot:title-after>
    <span class="comments-panel__approved">
      <span class="lucide lucide-check-check" aria-hidden="true"></span>{{ t('comments-approved-badge') }}
    </span>
    <span v-if="unresolved" class="right-panel-shell__count">
      <span aria-hidden="true">{{ unresolved }}</span>
      <span class="qc-sr-only">{{ countLabel }}</span>
    </span>
  </template>

  <template v-slot:nav>
  <comments-filter
    :filter="filter"
    :all-count="roots.length"
    :block="filterBlock"
    :t="t"
    @filter="vm.commentsStore.filter($event)"
  ></comments-filter>
  </template>

  <comments-list
    :comments="comments"
    :all-comments="allComments"
    :filter="filter"
    :status="status"
    :pending-count="pendingCount"
    :editing-id="edit ? edit.comment._id : null"
    :replying-id="reply ? reply.comment._id : null"
    :t="t"
    :format-date="formatDate"
    :label-of="labelOf"
    :block-exists="blockExists"
    :can="can"
    @retry="vm.loadComments()"
    @show-new="vm.showNewComments()"
    @reply="startReply"
    @edit="startEdit"
    @resolve="act('resolve', $event)"
    @unresolve="act('unresolve', $event)"
    @delete="act('delete', $event)"
    @go-to-block="act('go-to-block', $event)"
  >
    <template v-slot:edit="{ comment }">
      <comment-inline-form
        :text="edit.text"
        :users="users"
        :label="t('comments-edit')"
        :submit-label="t('comments-save')"
        :busy="busy"
        :t="t"
        @input="edit.text = $event"
        @mention="addMention(edit, $event)"
        @cancel="stopWriting(comment)"
        @submit="sendEdit"
      ></comment-inline-form>
    </template>
    <template v-slot:reply="{ comment }">
      <comment-inline-form
        :text="reply.text"
        :users="users"
        :label="t('comments-reply')"
        :submit-label="t('comments-add')"
        :busy="busy"
        :t="t"
        @input="reply.text = $event"
        @mention="addMention(reply, $event)"
        @cancel="stopWriting(comment)"
        @submit="sendReply"
      ></comment-inline-form>
    </template>
  </comments-list>

  <template v-slot:footer>
  <comment-composer
    :text="text"
    :users="users"
    :target="target"
    :selected="selected"
    :label-of="labelOf"
    :category="category"
    :severity="severity"
    :can-approve="canApprove && !approved"
    :approve-blocked="openBlocking"
    :busy="busy"
    :t="t"
    @input="vm.commentsStore.draftText($event)"
    @mention="mention"
    @target="vm.commentsStore.setTarget($event)"
    @category="vm.commentsStore.draftCategory($event)"
    @severity="vm.commentsStore.draftSeverity($event)"
    @submit="submit"
    @approve="approve"
  ></comment-composer>
  </template>
</right-panel-shell>
`;

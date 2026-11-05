'use strict';

const Vue = require('vue/dist/vue.common');
const koMirror = require('../../mixins/ko-mirror');
const { RightPanelShell } = require('../right-panel/right-panel-shell');
const { CommentsFilter } = require('./comments-filter');
const { CommentsList } = require('./comments-list');
const { CommentComposer } = require('./comment-composer');
const { CommentInlineForm } = require('./comment-inline-form');
const {
  approvalOf,
  isApproval,
} = require('../../../ext/comments/comments-thread');
const template = require('./comments-panel.template');

const MENTION = /@\[([^\]]+)\]\(([a-f0-9]+)\)/g;
const isRoot = (c) => !c._parentComment;
const cssEscape = (value) =>
  window.CSS && window.CSS.escape ? window.CSS.escape(value) : value;
// Frozen: Vue leaves them as the store gave them, without its getters.
const frozen = (items) => Object.freeze((items || []).slice());

/**
 * The comments panel, in Vue (ADR 0020): the shell, the filter, the list and
 * the form, out of the comments' store (ext/comments/comments-store.js).
 * What is written goes through the view model (ext/badsender-comments.js),
 * which the canvas and the quality control share: the draft and its target
 * are the store's, the reply and the edit under way are this panel's.
 */
const CommentsPanel = Vue.component('CommentsPanel', {
  components: {
    RightPanelShell,
    CommentsFilter,
    CommentsList,
    CommentComposer,
    CommentInlineForm,
  },
  mixins: [koMirror],
  props: {
    vm: { type: Object, required: true },
  },
  data: () => ({
    comments: [],
    allComments: [],
    status: false,
    pendingCount: 0,
    unresolved: 0,
    filter: null,
    target: null,
    text: '',
    category: 'general',
    severity: 'info',
    selectedId: null,
    users: [],
    openBlocking: false,
    // Whom the rights are read for: they change once the user is known.
    userKey: 0,
    blocksVersion: 0,
    busy: false,
    reply: null,
    edit: null,
  }),
  created() {
    const { vm } = this;
    const store = vm.commentsStore;
    this.mirror(store.comments, (v) => (this.comments = frozen(v)));
    this.mirror(store.allComments, (v) => (this.allComments = frozen(v)));
    this.mirror(store.status, (v) => (this.status = v));
    this.mirror(store.pendingCount, (v) => (this.pendingCount = v));
    this.mirror(store.unresolvedCount, (v) => (this.unresolved = v));
    this.mirror(store.filter, (v) => (this.filter = v));
    this.mirror(store.target, (v) => (this.target = v));
    this.mirror(store.draftText, (v) => (this.text = v));
    this.mirror(store.draftCategory, (v) => (this.category = v));
    this.mirror(store.draftSeverity, (v) => (this.severity = v));
    this.mirror(vm.hasOpenBlocking, (v) => (this.openBlocking = v));
    this.mirror(vm.groupUsers, (v) => (this.users = frozen(v)));
    this.mirror(vm.selectedBlock, (block) => {
      const id = block && (typeof block.id === 'function' ? block.id() : block.id);
      this.selectedId = id || null;
    });
    this.mirror(vm.currentUser, () => (this.userKey += 1));
    // Blocks added, moved, deleted or restored: their labels and whether they
    // still exist are read again (Vue does not follow the email's model).
    this.mirror(vm.commentBlocksVersion, () => (this.blocksVersion += 1));
  },
  computed: {
    approved() {
      return approvalOf(this.allComments).approved;
    },
    // Root comments, approvals left out: what the filter counts.
    roots() {
      return this.comments.filter((c) => isRoot(c) && !isApproval(c));
    },
    // The chip of a block: the block read, else the block selected.
    filterBlock() {
      const id = this.blocksVersion >= 0 && (this.filter || this.selectedId);
      if (!id) return null;
      return {
        id,
        label: this.vm.commentBlockLabel(id),
        count: this.roots.filter((c) => c.blockId === id).length,
      };
    },
    selected() {
      if (!this.selectedId || this.blocksVersion < 0) return null;
      return { id: this.selectedId, label: this.vm.commentBlockLabel(this.selectedId) };
    },
    canApprove() {
      return this.userKey >= 0 && this.vm.canPostDecision();
    },
    countLabel() {
      return this.t(
        this.unresolved === 1 ? 'panel-rail-unresolved-one' : 'panel-rail-unresolved',
        { count: this.unresolved }
      );
    },
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    formatDate(date) {
      return this.vm.formatDate(date);
    },
    labelOf(blockId) {
      return this.blocksVersion >= 0 && this.vm.commentBlockLabel(blockId);
    },
    blockExists(blockId) {
      return this.blocksVersion >= 0 && this.vm.blockExists(blockId);
    },
    can(action, comment) {
      if (this.userKey < 0) return false;
      if (action === 'delete') return this.vm.canDeleteComment(comment);
      return this.vm.isCommentAuthor(comment);
    },
    close() {
      this.vm.rightPanel.hide();
    },
    // Set before waiting: a double click sends one comment.
    send(write) {
      if (this.busy) return Promise.resolve(false);
      this.busy = true;
      return Promise.resolve()
        .then(write)
        .catch(() => false)
        .then((done) => {
          this.busy = false;
          return done;
        });
    },
    // The control that had the focus went with its comment: the title takes
    // it, and says where the user is.
    refocus() {
      if (this.$refs.shell) this.$refs.shell.focusTitle();
    },
    submit() {
      this.send(() => this.vm.createComment());
    },
    // The approval, once posted, takes the focus: the button goes.
    approve() {
      this.send(() => this.vm.createComment('approved')).then((done) => {
        if (!done) return;
        this.$nextTick(() => {
          const approval = this.$el.querySelector('.comment-approval');
          if (approval) approval.focus();
          else this.refocus();
        });
      });
    },
    mention(mention) {
      const tracked = this.vm.trackedMentions;
      if (!tracked().some((m) => m.userId === mention.userId)) tracked.push(mention);
    },
    // A reply under its comment; the reply button gets the focus back.
    startReply(comment) {
      this.edit = null;
      this.reply = { comment, text: '', mentions: [] };
    },
    // The text as written, mentions shown « @Name » and known again.
    startEdit(comment) {
      this.reply = null;
      const mentions = [];
      const text = (comment.text || '').replace(MENTION, (match, name, userId) => {
        mentions.push({ name, userId, displayText: `@${name}` });
        return `@${name}`;
      });
      this.edit = { comment, text, mentions };
    },
    addMention(draft, mention) {
      if (!draft.mentions.some((m) => m.userId === mention.userId)) {
        draft.mentions.push(mention);
      }
    },
    sendReply() {
      const { comment, text, mentions } = this.reply;
      this.send(() => this.vm.replyToComment(comment, text, mentions)).then((done) => {
        if (done) this.stopWriting(comment);
      });
    },
    sendEdit() {
      const { comment, text, mentions } = this.edit;
      this.send(() => this.vm.editComment(comment, text, mentions)).then((done) => {
        if (done) this.stopWriting(comment);
      });
    },
    // Back to the comment the reply or the edit was written on.
    stopWriting(comment) {
      this.reply = null;
      this.edit = null;
      this.$nextTick(() => {
        const item = this.$el.querySelector(
          `[data-comment-id="${cssEscape(comment._id)}"]`
        );
        if (item) item.focus();
      });
    },
    // A deleted, resolved or reopened comment leaves its place in the list:
    // the focus goes to the title, not to the page.
    act(name, comment) {
      if (name === 'go-to-block') {
        this.vm.goToCommentBlock(comment);
        return;
      }
      const write = {
        delete: 'remove',
        resolve: 'resolve',
        unresolve: 'unresolve',
      }[name];
      this.vm.commentsActions[write](comment).then(
        (done) => done !== false && this.refocus(),
        () => {}
      );
    },
  },
  template,
});

module.exports = { CommentsPanel };

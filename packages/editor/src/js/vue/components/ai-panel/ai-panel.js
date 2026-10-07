'use strict';

const Vue = require('vue/dist/vue.common');
const axios = require('axios');
const { generateSubjects, generatePreheaders } = require('../../utils/apis');
const {
  availableActions,
  ACTIONS,
} = require('../../../ext/ai-panel/action-registry');
const {
  createActionSession,
} = require('../../../ext/ai-panel/action-session');
const { createEditorAccess } = require('../../../ext/ai-panel/editor-access');
const { placeFieldIcons } = require('../../../ext/ai-panel/field-icons');
const template = require('./ai-panel.template');

const EMAIL = Object.freeze({ kind: 'email' });

// The target of the canvas selection: a block, or the whole email. The block
// that holds the preheader is the preheader's target, so the panel offers what
// the field's icon offers.
const targetOf = (block) => {
  if (!block) return EMAIL;
  const blockType = block.type();
  if (blockType === 'preheaderBlock') return { kind: 'preheader' };
  return { kind: 'block', blockType };
};

// What each field's AI icon says, since it opens the action itself.
const ICON_LABELS = {
  subject: 'ai-field-subject-label',
  preheader: 'ai-field-preheader-label',
};

const ROUTES = { subject: generateSubjects, preheader: generatePreheaders };

const api = {
  generate: (kind, body) =>
    axios.post(ROUTES[kind](), body).then((response) => response.data),
};

// The words of each action, in the list and at the head of its steps.
const LABELS = {
  [ACTIONS.SUBJECT]: {
    name: 'ai-panel-action-subject',
    generate: 'ai-panel-generate-subject',
    proposals: 'text-generation-subjects-title',
    copyHint: 'text-generation-copy-hint',
    applied: 'text-generation-applied-subject',
  },
  [ACTIONS.PREHEADER]: {
    name: 'ai-panel-action-preheader',
    generate: 'ai-panel-generate-preheader',
    proposals: 'text-generation-preheaders-title',
    copyHint: 'text-generation-copy-hint-preheader',
    applied: 'text-generation-applied-preheader',
  },
};

/**
 * The AI panel, « Outils IA » (ADR 0004): the actions that need no target,
 * then the steps of the action the user picked. The steps themselves live in
 * an action session (ext/ai-panel/action-session.js); this only renders them.
 * Its place, Escape and the focus on open and close are the right panel's
 * (ext/right-panel.js); the focus between the steps is this panel's.
 */
const AiPanel = Vue.component('AiPanel', {
  props: {
    vm: { type: Object, required: true },
  },
  data: () => ({
    // The actions of the whole email, read from the email on every open.
    actions: [],
    // What the list is about: the canvas selection, or the whole email.
    target: EMAIL,
    targetActions: [],
    // The selection moved during an action: its proposals stay, the panel
    // offers the actions of the new element.
    selectionChanged: null,
    // The action under way, or null for the list.
    session: null,
    // The user chose to go on without a subject.
    goOnAnyway: false,
    brief: '',
    copyError: false,
    undoRefused: false,
    // Said to screen readers: proposals arrived, copied, undone.
    liveMessage: '',
    subscriptions: [],
    iconsObserver: null,
  }),
  computed: {
    action() {
      if (!this.session) return null;
      return this.actions.find((a) => a.id === this.session.state.action);
    },
    labels() {
      return this.session ? LABELS[this.session.state.action] : null;
    },
    state() {
      return this.session ? this.session.state : null;
    },
    // The strong suggestion to write the subject first (preheader only).
    urgesSubjectFirst() {
      return Boolean(
        this.action &&
          this.action.suggestFirst &&
          !this.goOnAnyway &&
          !this.state.proposals.length
      );
    },
    canApply() {
      return Boolean(this.action && this.action.canApply);
    },
    picked() {
      return this.state && this.state.proposals[this.state.selectedIndex];
    },
    appliedText() {
      const { applied } = this.state || {};
      return applied ? Object.values(applied)[0] : '';
    },
    nextAction() {
      return this.session ? this.session.nextAction() : null;
    },
  },
  created() {
    this.editor = createEditorAccess(this.vm);
  },
  mounted() {
    this.subscriptions = [
      this.vm.showAi.subscribe((isOpen) => {
        if (isOpen) this.refresh();
      }),
      this.vm.selectedBlock.subscribe(this.follow),
    ];
    this.watchFieldIcons();
  },
  beforeDestroy() {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    if (this.iconsObserver) this.iconsObserver.disconnect();
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    nameOf(id) {
      return LABELS[id].name;
    },
    actionsFor(target) {
      return availableActions(target, this.editor.context());
    },
    // The email is read once for both lists.
    refresh() {
      const context = this.editor.context();
      this.actions = availableActions(EMAIL, context).actions;
      this.targetActions =
        this.target.kind === 'email'
          ? []
          : availableActions(this.target, context).actions;
    },
    // The panel follows the selection while it shows a list, never in the
    // middle of an action: its proposals are not lost to a click elsewhere.
    // It only says the selection changed when the new element has actions
    // (a click on the background just deselects).
    follow(block) {
      const target = targetOf(block);
      if (this.session) {
        const offers = block && this.actionsFor(target).actions.length > 0;
        this.selectionChanged = offers ? target : null;
        return;
      }
      this.target = target;
      if (this.vm.showAi()) this.refresh();
    },
    // From an AI icon: its single action directly, the list otherwise.
    openTarget(target) {
      const { actions, opens } = this.actionsFor(target);
      if (opens === 'action') this.openAction(actions[0].id);
      else if (opens === 'list') this.showList(target);
    },
    // The subject and preheader fields re-render (Vue, Knockout): the icons are
    // placed again on every change of the toolbox, never twice.
    watchFieldIcons() {
      const root = document.getElementById('main-toolbox');
      if (!root) return;
      let pending = null;
      const place = () => {
        pending = null;
        const context = this.editor.context();
        placeFieldIcons(root, {
          actionsFor: (target) => availableActions(target, context),
          onOpen: this.openTarget,
          labelFor: (kind) => this.t(ICON_LABELS[kind]),
        });
      };
      this.iconsObserver = new MutationObserver(() => {
        if (!pending) pending = setTimeout(place, 100);
      });
      this.iconsObserver.observe(root, { childList: true, subtree: true });
      place();
    },
    // After a step replaced what had the focus: put it where the user goes on.
    focusAfterRender(ref) {
      this.$nextTick(() => {
        const element = this.$refs[ref];
        const target = Array.isArray(element) ? element[0] : element;
        if (target) target.focus();
      });
    },
    reset() {
      this.selectionChanged = null;
      this.goOnAnyway = false;
      this.brief = '';
      this.copyError = false;
      this.undoRefused = false;
      this.liveMessage = '';
    },
    showList(target = targetOf(this.vm.selectedBlock())) {
      this.session = null;
      this.reset();
      this.target = target;
      this.refresh();
      this.vm.showAi(true);
      this.focusAfterRender('heading');
    },
    openAction(id) {
      this.refresh();
      if (!this.actions.some((a) => a.id === id)) return;
      this.session = createActionSession({
        action: id,
        api,
        editor: this.editor,
      });
      this.reset();
      this.vm.showAi(true);
      this.focusAfterRender('heading');
    },
    goOn() {
      this.goOnAnyway = true;
      this.focusAfterRender('brief');
    },
    async ask(request) {
      this.copyError = false;
      this.undoRefused = false;
      this.liveMessage = this.t('ai-panel-loading');
      await request;
      if (this.state.error || !this.state.proposals.length) return;
      this.liveMessage = this.t('ai-panel-proposed', {
        count: this.state.proposals.length,
      });
      this.focusAfterRender('proposals');
    },
    generate() {
      return this.ask(this.session.request({ brief: this.brief }));
    },
    more() {
      return this.ask(this.session.requestMore({ brief: this.brief }));
    },
    apply() {
      this.session.apply();
      this.refresh();
      this.focusAfterRender('applied');
    },
    undo() {
      this.undoRefused = !this.session.undo();
      this.refresh();
      if (this.undoRefused) return;
      this.liveMessage = this.t('ai-panel-undone');
      this.focusAfterRender('picked');
    },
    async copy(index) {
      try {
        await navigator.clipboard.writeText(this.state.proposals[index].text);
        this.session.copied(index);
        this.copyError = false;
        this.liveMessage = this.t('text-generation-copied');
        this.refresh();
      } catch (err) {
        this.copyError = true;
      }
    },
    close() {
      this.vm.showAi(false);
    },
  },
  template,
});

module.exports = { AiPanel };

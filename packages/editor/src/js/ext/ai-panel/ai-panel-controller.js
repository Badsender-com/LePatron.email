'use strict';

const { availableActions } = require('./action-registry');
const { ACTIONS, definitionOf } = require('./actions');
const { createActionSession } = require('./action-session');
const { EMAIL, targetOfBlock, sameTarget } = require('./targets');

/**
 * The AI panel's state and decisions, outside any component (#1192), as
 * quality control keeps its own in ext/quality/quality-review.js: what the
 * panel lists, the action under way, and following the canvas selection. The
 * Vue panel renders it.
 *
 * The last session of each action is kept, the whole email's apart from the
 * last block's or field's: going back to the list, or to another action,
 * loses nothing, correcting a block leaves the corrections of the email as
 * they were, and opening the action again on the same target finds it as it was —
 * its instruction, its proposals, a request still under way — unless what its
 * proposals were built on has changed since (the subject, for the preheader:
 * `builtOn` in its definition).
 *
 * @param {{
 *   ko: Object,
 *   editor: Object,       the email (ext/ai-panel/editor-access.js)
 *   api: Object,          the text generation routes
 *   isOpen: Function,     the AI panel's flag of the right panel
 *   selection: Function,  the canvas selection (viewModel.selectedBlock)
 *   fieldSelection?: Function, the field selection (viewModel.selectedItem)
 *   editedField?: Function, the block field being edited, or null
 *   definitions?: Array,  the action definitions, all of them by default
 * }} params
 */
function createAiPanel({
  ko,
  editor,
  api,
  isOpen,
  selection,
  fieldSelection = null,
  editedField = () => null,
  definitions = ACTIONS,
}) {
  // What the list is about: the canvas selection, or the whole email.
  const target = ko.observable(EMAIL);
  // The actions of the whole email, and those of the selected element.
  const actions = ko.observable([]);
  const targetActions = ko.observable([]);
  // The action under way, or null for the list, and what it offers now.
  const session = ko.observable(null);
  const sessionAction = ko.observable(null);
  // The selection moved during an action, to an element with actions.
  const selectionChanged = ko.observable(null);
  // The last session of each action, with what it was built on: one on the
  // email (its subject and preheader are the email's), one on a block or a
  // field of a block (keyOf).
  const kept = new Map();
  const keyOf = (id, on) => `${id}:${on.blockId ? 'block' : 'email'}`;

  const offer = (forTarget, context) =>
    availableActions(forTarget, context, definitions);

  // The email is read once for every list.
  function refresh() {
    const context = editor.context();
    actions(offer(EMAIL, context).actions);
    targetActions(
      target().kind === 'email' ? [] : offer(target(), context).actions
    );
    const current = session();
    sessionAction(
      current
        ? offer(current.state.target, context).actions.find(
            (action) => action.id === current.state.action
          ) || null
        : null
    );
  }

  // What the canvas selection targets: the field being edited, or else the
  // selected block, or the whole email. Read when the selection changes and
  // kept: the focus later moves to the panel, the selection does not. Finding
  // the field is costly: the panel closed, it is read when it opens.
  const selected = () => editedField() || targetOfBlock(selection());
  let selectedTarget = selected();
  // The selection changed while the panel was closed.
  let selectionUnread = false;
  // An entry point opens the panel on what it names, not on the selection.
  let revealing = false;

  // The panel follows the selection while it lists, never in the middle of an
  // action, applied or not: its proposals are not lost to a click elsewhere.
  // Returns whether the list follows it.
  function readSelection() {
    const block = selection();
    selectedTarget = selected();
    selectionUnread = false;
    const followed = selectedTarget;
    const current = session();
    if (!current) {
      target(followed);
      return true;
    }
    const { action, target: under } = current.state;
    // An action of blocks run on the whole email covers every block:
    // selecting one (« Aller au bloc ») is no other element; nor is the
    // element the action is on.
    const actsOnBlocks = definitionOf(action, definitions).targets.includes(
      'block'
    );
    const covered =
      (under.kind === 'email' && actsOnBlocks) ||
      (followed.kind === under.kind && sameTarget(followed, under));
    const offers =
      !covered && block && offer(followed, editor.context()).actions.length > 0;
    selectionChanged(offers ? followed : null);
    return false;
  }

  function follow() {
    if (!isOpen()) {
      selectionUnread = true;
      return;
    }
    if (readSelection()) refresh();
  }

  // Opened by an entry point (an icon, the list of a target): the selection
  // is read, and the panel shows what the entry point named.
  function reveal() {
    if (isOpen()) return;
    revealing = true;
    try {
      isOpen(true);
    } finally {
      revealing = false;
    }
  }

  // The action shown gives way: it stops asking, as when the panel closes, and
  // keeps what it found for when the user comes back to it.
  function show(next) {
    const current = session();
    if (current && current !== next && current.stop) current.stop();
    session(next);
  }

  function showList(listed = selectedTarget) {
    show(null);
    selectionChanged(null);
    target(listed);
    refresh();
    reveal();
  }

  // Another target, or another basis, is other work: its session replaces the
  // action's last one.
  function sessionOf(id, on) {
    const { builtOn } = definitionOf(id, definitions) || {};
    const basis = builtOn ? builtOn(editor) : undefined;
    const key = keyOf(id, on);
    const last = kept.get(key);
    if (
      last &&
      sameTarget(last.session.state.target, on) &&
      last.basis === basis
    ) {
      return last.session;
    }
    // The session it replaces is let go of: what it still asks is cancelled.
    if (last && last.session.cancel) last.session.cancel();
    const created = createActionSession({
      action: id,
      target: on,
      api,
      editor,
      definitions,
    });
    kept.set(key, { session: created, basis });
    return created;
  }

  /**
   * Open an action on its target, as the user left it if they already had.
   * @returns {boolean} false when the target does not offer it
   */
  function openAction(id, on = EMAIL) {
    const offered = offer(on, editor.context()).actions.some(
      (action) => action.id === id
    );
    if (!offered) return false;
    const opened = sessionOf(id, on);
    // The one already shown: the panel keeps its steps as they are.
    if (session() !== opened) show(opened);
    selectionChanged(null);
    refresh();
    reveal();
    return true;
  }

  // From an AI icon or a target: its single action directly, the list otherwise.
  function openTarget(opened) {
    const { actions: offered, opens } = offer(opened, editor.context());
    if (opens === 'action') openAction(offered[0].id, opened);
    else if (opens === 'list') showList(opened);
  }

  // What each target offers, the email read once: for placing many icons.
  function offerNow() {
    const context = editor.context();
    return (forTarget) => offer(forTarget, context);
  }

  const subscriptions = [
    // Closed: the action under way stops asking, and keeps what it found.
    isOpen.subscribe((open) => {
      const current = session();
      if (!open) {
        if (current && current.stop) current.stop();
        return;
      }
      if (selectionUnread) {
        if (revealing) {
          selectedTarget = selected();
          selectionUnread = false;
        } else readSelection();
      }
      refresh();
    }),
    selection.subscribe(follow),
    ...(fieldSelection ? [fieldSelection.subscribe(follow)] : []),
  ];
  // The action under way follows the editor's undo: a correction taken back.
  const stopHistory = editor.onHistory
    ? editor.onHistory(() => {
        const current = session();
        if (current && current.refresh) current.refresh();
      })
    : () => {};

  return {
    target,
    actions,
    targetActions,
    session,
    sessionAction,
    selectionChanged,
    refresh,
    showList,
    openAction,
    openTarget,
    offerNow,
    dispose() {
      subscriptions.forEach((subscription) => subscription.dispose());
      kept.forEach(({ session: left }) => left.cancel && left.cancel());
      kept.clear();
      stopHistory();
      session(null);
    },
  };
}

module.exports = { createAiPanel };

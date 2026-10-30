'use strict';

const { availableActions } = require('./action-registry');
const { ACTIONS } = require('./actions');
const { createActionSession } = require('./action-session');
const { EMAIL, targetOfBlock } = require('./targets');

/**
 * The AI panel's state and decisions, outside any component (#1192), as
 * quality control keeps its own in ext/quality/quality-review.js: what the
 * panel lists, the action under way, and following the canvas selection. The
 * Vue panel renders it.
 *
 * @param {{
 *   ko: Object,
 *   editor: Object,       the email (ext/ai-panel/editor-access.js)
 *   api: Object,          the text generation routes
 *   isOpen: Function,     the AI panel's flag of the right panel
 *   selection: Function,  the canvas selection (viewModel.selectedBlock)
 *   definitions?: Array,  the action definitions, all of them by default
 * }} params
 */
function createAiPanel({
  ko,
  editor,
  api,
  isOpen,
  selection,
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

  // The panel follows the selection while it lists, never in the middle of an
  // action, applied or not: its proposals are not lost to a click elsewhere.
  function follow(block) {
    const followed = targetOfBlock(block);
    if (session()) {
      const offers =
        block && offer(followed, editor.context()).actions.length > 0;
      selectionChanged(offers ? followed : null);
      return;
    }
    target(followed);
    if (isOpen()) refresh();
  }

  function showList(listed = targetOfBlock(selection())) {
    session(null);
    selectionChanged(null);
    target(listed);
    refresh();
    isOpen(true);
  }

  /**
   * Open an action on its target.
   * @returns {boolean} false when the target does not offer it
   */
  function openAction(id, on = EMAIL) {
    const offered = offer(on, editor.context()).actions.some(
      (action) => action.id === id
    );
    if (!offered) return false;
    session(
      createActionSession({ action: id, target: on, api, editor, definitions })
    );
    selectionChanged(null);
    refresh();
    isOpen(true);
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
    isOpen.subscribe((open) => {
      if (open) refresh();
    }),
    selection.subscribe(follow),
  ];

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
    },
  };
}

module.exports = { createAiPanel };

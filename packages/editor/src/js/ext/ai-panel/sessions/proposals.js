'use strict';

const { orUndefined } = require('../actions/text');

/**
 * The steps of an action of the "proposals" family (text generation): ask for
 * proposals, ask for others, pick one, apply it, undo it, or copy it when the
 * email has no field to write to. Nothing is written into the email before
 * `apply` (ADR 0003). What is asked and where it is written come from the
 * action's definition (ext/ai-panel/actions).
 *
 * `api.generate(route, body)` calls the text generation route; `editor` reads
 * and writes the email (ext/ai-panel/editor-access.js).
 */

// The proposals already seen that "Proposer d'autres" sends back (server limit).
const MAX_AVOID = 30;

// What the user can act on, by status of the text generation routes.
const ERROR_KEYS = {
  403: 'text-generation-error-disabled',
  413: 'text-generation-error-too-large',
  429: 'text-generation-error-rate-limited',
  502: 'text-generation-error-failed',
  503: 'text-generation-error-unavailable',
};

const errorKey = (err) => {
  const status = err && err.response && err.response.status;
  if (!status) return 'text-generation-error-network';
  return ERROR_KEYS[status] || 'text-generation-error-failed';
};

const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );

/**
 * @param {{ definition: Object, target: Object, api: { generate: Function }, editor: Object }} params
 */
function createProposalsSession({ definition, target, api, editor }) {
  // Every key present from the start: the panel makes this object reactive.
  const state = {
    action: definition.id,
    target,
    brief: '',
    isLoading: false,
    error: null,
    proposals: [],
    dropped: 0,
    // Every proposal shown so far: "Proposer d'autres" moves away from them.
    seen: [],
    selectedIndex: null,
    // The proposal the user copied, when the email has no field to write to.
    copiedIndex: null,
    applied: null,
    previous: null,
  };

  const selected = () => state.proposals[state.selectedIndex] || null;

  async function ask() {
    const content = editor.emailCopy();
    if (!content.length) {
      state.error = 'text-generation-empty-email';
      return;
    }
    state.error = null;
    state.isLoading = true;
    try {
      const data = await api.generate(
        definition.route,
        compact({
          mailingId: editor.mailingId,
          content,
          ...definition.request(editor, target),
          brief: orUndefined(state.brief),
          // The server takes the last 30: past that, older proposals matter
          // less than a request that keeps working.
          avoid: state.seen.length ? state.seen.slice(-MAX_AVOID) : undefined,
        })
      );
      state.dropped = data.dropped || 0;
      // Others all set aside: the proposals shown stay, rather than none.
      if (data.proposals.length || !state.proposals.length) {
        state.proposals = data.proposals;
        state.seen = state.seen.concat(data.proposals.map((p) => p.text));
        state.selectedIndex = null;
        state.copiedIndex = null;
      }
      state.applied = null;
    } catch (err) {
      state.error = errorKey(err);
    } finally {
      state.isLoading = false;
    }
  }

  const session = {
    state,
    request({ brief } = {}) {
      state.brief = brief || '';
      return ask();
    },
    // With the instruction as the user edited it since, if they did.
    requestMore({ brief } = {}) {
      if (brief !== undefined) state.brief = brief;
      return ask();
    },
    select(index) {
      state.selectedIndex = index;
    },
    canApply() {
      return Boolean(definition.canWrite(editor));
    },
    apply() {
      const picked = selected();
      if (!picked || !session.canApply()) {
        throw new Error(`Nothing to apply for "${definition.id}"`);
      }
      state.previous = definition.read(editor, target);
      definition.write(editor, target, picked.text);
      state.applied = { [definition.field]: picked.text };
    },
    // False, and nothing written, when the user changed the field by hand
    // since: undoing would silently lose their edit.
    undo() {
      if (!state.applied) return false;
      if (definition.read(editor, target) !== state.applied[definition.field]) return false;
      definition.write(editor, target, state.previous);
      state.applied = null;
      return true;
    },
    // When the email has no field to write to: the user pastes it elsewhere.
    textToCopy() {
      const picked = selected();
      return picked ? picked.text : null;
    },
    // The user copied a proposal, when the email has no field to write to;
    // the action may keep it (a copied subject is what the preheader builds on).
    copied(index) {
      state.selectedIndex = index;
      state.copiedIndex = index;
      if (definition.onCopied) definition.onCopied(editor, selected().text);
    },
    // What the panel offers once this action is applied, or copied.
    nextAction() {
      return state.applied || state.copiedIndex !== null ? definition.next : null;
    },
  };
  return session;
}

module.exports = { createProposalsSession };

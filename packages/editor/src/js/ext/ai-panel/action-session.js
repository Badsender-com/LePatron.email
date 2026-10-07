'use strict';

const { ACTIONS } = require('./action-registry');

/**
 * The steps of one AI action, outside any component, so that the AI panel only
 * renders them (ADR 0004): ask for proposals, ask for others, pick one, apply
 * it, undo it. Nothing is written into the email before `apply` (ADR 0003).
 *
 * `api.generate(kind, body)` calls the text generation route of that kind;
 * `editor` reads and writes the email (see editor-access.js).
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

// An empty field is no context for the skill.
const orUndefined = (text) => (text && text.trim() ? text : undefined);

// Per action: the route it calls, what it adds to the request, and how it
// reads and writes its field.
const KINDS = {
  [ACTIONS.SUBJECT]: {
    route: 'subject',
    field: 'subject',
    canApply: (editor) => editor.canApplySubject,
    body: (editor) => ({ currentSubject: orUndefined(editor.getSubject()) }),
    read: (editor) => editor.getSubject() || '',
    // The subject lives in the email metadata, outside the editor's undo.
    write: (editor, value) => editor.setSubject(value),
    next: ACTIONS.PREHEADER,
  },
  [ACTIONS.PREHEADER]: {
    route: 'preheader',
    field: 'preheader',
    canApply: (editor) => editor.canApplyPreheader,
    body: (editor) => ({
      // The subject on screen, or the one the user copied for their platform.
      subject: orUndefined(editor.knownSubject()),
      currentPreheader: orUndefined(editor.getPreheader()),
    }),
    read: (editor) => editor.getPreheader() || '',
    // A template property: one step of the editor's own undo.
    write: (editor, value) => {
      editor.startMultiple();
      try {
        editor.setPreheader(value);
      } finally {
        editor.stopMultiple();
      }
    },
    next: null,
  },
};

/**
 * @param {{ action: string, api: { generate: Function }, editor: Object }} params
 */
function createActionSession({ action, api, editor }) {
  const kind = KINDS[action];
  if (!kind) throw new Error(`Unknown AI action "${action}"`);

  // Every key present from the start: the panel makes this object reactive.
  const state = {
    action,
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
        kind.route,
        compact({
          mailingId: editor.mailingId,
          content,
          ...kind.body(editor),
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
      return Boolean(kind.canApply(editor));
    },
    apply() {
      const picked = selected();
      if (!picked || !session.canApply()) {
        throw new Error(`Nothing to apply for "${action}"`);
      }
      state.previous = kind.read(editor);
      kind.write(editor, picked.text);
      state.applied = { [kind.field]: picked.text };
    },
    // False, and nothing written, when the user changed the field by hand
    // since: undoing would silently lose their edit.
    undo() {
      if (!state.applied) return false;
      if (kind.read(editor) !== state.applied[kind.field]) return false;
      kind.write(editor, state.previous);
      state.applied = null;
      return true;
    },
    // When the email has no field to write to: the user pastes it elsewhere.
    textToCopy() {
      const picked = selected();
      return picked ? picked.text : null;
    },
    // The user copied a proposal. A copied subject is the one the preheader
    // then builds on, as if it had been applied.
    copied(index) {
      state.selectedIndex = index;
      state.copiedIndex = index;
      if (kind.field === 'subject') editor.rememberSubject(selected().text);
    },
    // What the panel offers once this action is applied, or copied.
    nextAction() {
      return state.applied || state.copiedIndex !== null ? kind.next : null;
    },
  };
  return session;
}

module.exports = { createActionSession };

'use strict';

/**
 * Which AI actions a target offers, and whether its AI icon opens the action
 * itself or the list (ADR 0004). One pure function, so that the « Outils IA »
 * panel, the icons and the actions to come cannot disagree.
 *
 * Targets: `{ kind: 'email' }` (the panel with nothing selected),
 * `{ kind: 'subject' }`, `{ kind: 'preheader' }`, and blocks or block fields,
 * which offer nothing until their skills exist.
 */

const SUBJECT = 'generate-subject';
const PREHEADER = 'generate-preheader';

// The actions a target kind offers, in the order the panel lists them.
const ACTIONS_BY_KIND = {
  email: [SUBJECT, PREHEADER],
  subject: [SUBJECT],
  preheader: [PREHEADER],
};

const NONE = Object.freeze({ actions: [], opens: 'none' });

/**
 * @param {string} id
 * @param {Object} context
 * @returns {{ id: string, canApply: boolean, suggestFirst?: string }}
 */
function describe(id, context) {
  if (id === SUBJECT) {
    return { id, canApply: Boolean(context.hasSubjectField) };
  }
  const action = { id, canApply: Boolean(context.hasPreheaderField) };
  // The preheader complements the subject: without one, urge to write it
  // first, without forbidding to go on (it may be set in the sending platform).
  if (!context.hasSubject) action.suggestFirst = SUBJECT;
  return action;
}

/**
 * @param {{ kind: string }} target
 * @param {{
 *   textGeneration: boolean,
 *   hasSubject: boolean,
 *   hasSubjectField: boolean,
 *   hasPreheaderField: boolean,
 * }} context
 * @returns {{ actions: Array, opens: 'none'|'action'|'list' }}
 */
function availableActions(target, context) {
  const ids = (context.textGeneration && ACTIONS_BY_KIND[target.kind]) || [];
  if (!ids.length) return { ...NONE, actions: [] };
  const actions = ids.map((id) => describe(id, context));
  return { actions, opens: actions.length === 1 ? 'action' : 'list' };
}

module.exports = {
  availableActions,
  ACTIONS: Object.freeze({ SUBJECT, PREHEADER }),
};

'use strict';

const { ACTIONS } = require('./actions');

/**
 * Which AI actions a target offers, and whether its AI icon opens the action
 * itself or the list (ADR 0010). One pure function over the action
 * definitions (ext/ai-panel/actions), so that the « Outils IA » panel, the
 * icons and the actions to come cannot disagree.
 *
 * Targets (ext/ai-panel/targets.js): `{ kind: 'email' }`, the subject and
 * preheader fields, a block `{ kind: 'block', blockId, blockType }`, a block
 * field `{ kind: 'blockField', blockId, blockType, field }`.
 */

/**
 * Whether an action can run in a context: its AI feature on for this user on
 * this email, and the skill it calls running for the email's company. An
 * action that names no skill runs nowhere: each one is published, opened to
 * the client companies and taken back on its own (ADR 0013).
 */
function runs(definition, context) {
  return (
    Boolean(definition) &&
    Boolean(context[definition.feature]) &&
    Boolean(definition.skill) &&
    (context.skills || []).includes(definition.skill)
  );
}

/**
 * @param {{ kind: string }} target
 * @param {Object} context what the email offers: the active AI features
 *   (`textGeneration`…), the skills that run for the company (`skills`),
 *   `hasSubject`, `hasSubjectField`, `hasPreheaderField`
 * @param {Array} [definitions] the action definitions, all of them by default
 * @returns {{ actions: Array, opens: 'none'|'action'|'list' }}
 */
function availableActions(target, context, definitions = ACTIONS) {
  const runsById = (id) =>
    runs(
      definitions.find((definition) => definition.id === id),
      context
    );
  const actions = definitions
    .filter(
      (definition) =>
        runs(definition, context) && definition.targets.includes(target.kind)
    )
    .map((definition) => {
      const { suggestFirst, ...described } = definition.describe(context);
      return {
        id: definition.id,
        ...described,
        // Another action is suggested first, or offered next, only where it
        // runs too: never a button that opens nothing.
        ...(suggestFirst && runsById(suggestFirst) && { suggestFirst }),
        ...(definition.next &&
          runsById(definition.next) && { next: definition.next }),
      };
    });
  if (!actions.length) return { actions: [], opens: 'none' };
  return { actions, opens: actions.length === 1 ? 'action' : 'list' };
}

module.exports = { availableActions };

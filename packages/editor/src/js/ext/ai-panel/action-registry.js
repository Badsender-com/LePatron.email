'use strict';

const { ACTIONS } = require('./actions');

/**
 * Which AI actions a target offers, and whether its AI icon opens the action
 * itself or the list (ADR 0004). One pure function over the action
 * definitions (ext/ai-panel/actions), so that the « Outils IA » panel, the
 * icons and the actions to come cannot disagree.
 *
 * Targets (ext/ai-panel/targets.js): `{ kind: 'email' }`, the subject and
 * preheader fields, a block `{ kind: 'block', blockId, blockType }`, a block
 * field `{ kind: 'blockField', blockId, blockType, field }`.
 */

/**
 * @param {{ kind: string }} target
 * @param {Object} context what the email offers: the active AI features
 *   (`textGeneration`…), `hasSubject`, `hasSubjectField`, `hasPreheaderField`
 * @param {Array} [definitions] the action definitions, all of them by default
 * @returns {{ actions: Array, opens: 'none'|'action'|'list' }}
 */
function availableActions(target, context, definitions = ACTIONS) {
  const actions = definitions
    .filter(
      (definition) =>
        Boolean(context[definition.feature]) &&
        definition.targets.includes(target.kind)
    )
    .map((definition) => ({
      id: definition.id,
      ...definition.describe(context),
    }));
  if (!actions.length) return { actions: [], opens: 'none' };
  return { actions, opens: actions.length === 1 ? 'action' : 'list' };
}

module.exports = { availableActions };

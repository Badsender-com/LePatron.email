'use strict';

const { ACTIONS, definitionOf } = require('./actions');
const { createProposalsSession } = require('./sessions/proposals');
const { createCorrectionsSession } = require('./sessions/corrections');

/**
 * The steps of one AI action, outside any component, so that the AI panel only
 * renders them (ADR 0004). Each family of actions has its own steps (ADR 0004,
 * amended by #1192): "proposals" asks, lets the user pick and apply; a family
 * that only reads the email, or that corrects it one change at a time, will
 * bring its own.
 */
const FAMILIES = {
  proposals: createProposalsSession,
  corrections: createCorrectionsSession,
};

const EMAIL = Object.freeze({ kind: 'email' });

/**
 * @param {{
 *   action: string,
 *   target?: Object,
 *   api: Object,
 *   editor: Object,
 *   definitions?: Array,
 *   wait?: Function,
 * }} params
 */
function createActionSession({
  action,
  target = EMAIL,
  api,
  editor,
  definitions = ACTIONS,
  wait,
}) {
  const definition = definitionOf(action, definitions);
  if (!definition) throw new Error(`Unknown AI action "${action}"`);
  const create = FAMILIES[definition.family];
  if (!create) {
    throw new Error(`No steps for the "${definition.family}" family of AI actions`);
  }
  return create({ definition, target, api, editor, wait });
}

module.exports = { createActionSession, FAMILIES };

'use strict';

/**
 * The AI actions, one definition each (ADR 0004, amended by #1192): which
 * targets offer it and in what context, the family of its steps, how it asks
 * and writes, its words. The registry, the session, the controller and the
 * panel derive from these; adding an action means adding its definition here.
 *
 * In the order the panel lists them.
 */
const ACTIONS = Object.freeze([
  require('./generate-subject'),
  require('./generate-preheader'),
]);

/**
 * @param {string} id
 * @param {Array} [definitions]
 * @returns {Object|undefined}
 */
function definitionOf(id, definitions = ACTIONS) {
  return definitions.find((definition) => definition.id === id);
}

module.exports = { ACTIONS, definitionOf };

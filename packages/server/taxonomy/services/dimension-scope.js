'use strict';

const { DimensionScopes } = require('../../constant/taxonomy-type.js');

/**
 * Which dimensions an email offers (ADR-0024). A dimension of scope "every
 * email" always is. One of scope "the templates reading it" is when the email's
 * template contract names it, or reads a design token one of its values carries.
 *
 * Out of scope is treated like deactivated (ADR-0014): the values an email
 * carries stay on it, and are neither offered, published, nor sent to the AI.
 */
module.exports = { dimensionsInScope };

/**
 * @param {Object} params
 * @param {Array} params.dimensions with `name` and `scope`
 * @param {Array} params.values with `type` and `tokens`, the values of those
 *   dimensions (only their tokens are read)
 * @param {Object} [params.contract] the email's template contract; none offers
 *   no dimension restricted to the templates reading it
 * @returns {Array} the dimensions in scope, in the order given
 */
function dimensionsInScope({ dimensions, values, contract }) {
  const read = new Set([
    ...Object.keys(contract?.declared || {}),
    ...(contract?.read || []),
  ]);
  const tokensOf = (name) =>
    (values || [])
      .filter((value) => value.type === name)
      .flatMap((value) => Object.keys(plain(value.tokens)));

  return (dimensions || []).filter(
    (dimension) =>
      dimension.scope !== DimensionScopes.READING_TEMPLATES ||
      read.has(dimension.name) ||
      tokensOf(dimension.name).some((token) => read.has(token))
  );
}

// A Mongoose Map on a document, a plain object once lean.
const plain = (tokens) =>
  tokens instanceof Map ? Object.fromEntries(tokens) : tokens || {};

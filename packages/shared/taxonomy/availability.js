'use strict';

/**
 * Availability (ADR-0014), and the parent a dimension has on an email
 * (ADR-0024): the one rule the server, the editor, adoption and the
 * translation share, so that what one offers the other accepts.
 *
 * A value of a nested dimension is offered under the parent values its
 * availability lists, or under all of them when it lists none. A dimension's
 * parent counts on an email only when that parent is offered on it too, or is
 * the email type, which has its own field: a child whose parent is out of the
 * email's scope, or deactivated, is offered with all its values.
 */

const EMAIL_TYPE = 'emailType';

module.exports = { isOfferedUnder, effectiveParentName, inTreeOrder };

/**
 * @param {Object} value with `parentIds`, the ids of the parent values
 * @param {*} parentValue the id of the parent value chosen
 * @returns {boolean}
 */
function isOfferedUnder(value, parentValue) {
  const parentIds = (value.parentIds || []).map(String);
  return parentIds.length === 0 || parentIds.includes(String(parentValue));
}

/**
 * @param {Object} dimension with `parentName`
 * @param {Set<string>} offeredNames the dimensions offered on the email
 * @returns {string|null} the parent that counts, null for none
 */
function effectiveParentName(dimension, offeredNames) {
  const { parentName } = dimension;
  if (!parentName) return null;
  return parentName === EMAIL_TYPE || offeredNames.has(parentName)
    ? parentName
    : null;
}

/**
 * Parents before their children, so a child reads the value its parent just
 * took. A dimension under one not in the list (the email type) comes last.
 *
 * @param {Array} dimensions with `name` and `parentName`
 * @returns {Array}
 */
function inTreeOrder(dimensions) {
  const ordered = [];
  const place = (parentName) =>
    dimensions
      .filter((dimension) => (dimension.parentName || null) === parentName)
      .forEach((dimension) => {
        ordered.push(dimension);
        place(dimension.name);
      });
  place(null);
  return ordered.concat(
    dimensions.filter((dimension) => !ordered.includes(dimension))
  );
}

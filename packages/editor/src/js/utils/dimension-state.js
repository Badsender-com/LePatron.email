'use strict';

const {
  reconcileSelections,
  selectionsFromIds,
} = require('./dimension-selects');
const { governanceValues } = require('./governance-values');

/**
 * The state of the dimension selects of the email settings, as the Vue section
 * holds it: one key per dimension, an empty string for no value. Pure, so it is
 * tested apart: the editor has no component test harness, and anything left in
 * the plugin is untested. Covered by tests/editor/dimension-state.test.js.
 */
module.exports = { initialSelections, nextSelections, templateValuesFor };

/**
 * Every dimension gets its key up front: Vue 2 does not see a key added later,
 * and the select of a dimension the email has no value for would not react.
 *
 * @param {Array} dimensions what the server sends
 * @param {Array} taxonomyItemIds the values the email carries
 * @returns {Object} dimension name → value id, or `''`
 */
function initialSelections(dimensions, taxonomyItemIds) {
  const empty = (dimensions || []).reduce(
    (selections, dimension) => ({ ...selections, [dimension.name]: '' }),
    {}
  );
  return { ...empty, ...selectionsFromIds(dimensions, taxonomyItemIds) };
}

/**
 * The selections after a change, every key kept: a value no longer offered is
 * emptied rather than removed. Only the descendants of `changed` are looked at,
 * so a combination narrowed since the email chose it is kept, with its notice,
 * until the user changes its parent.
 *
 * @param {Object} params
 * @param {Array} params.dimensions
 * @param {Object} params.selections
 * @param {string} [params.emailTypeId]
 * @param {string[]} [params.changed]
 * @returns {Object}
 */
function nextSelections({ dimensions, selections, emailTypeId, changed }) {
  const kept = reconcileSelections({
    dimensions,
    selections,
    emailTypeId,
    changed,
  });
  return Object.keys(selections).reduce(
    (next, name) => ({ ...next, [name]: kept[name] || '' }),
    {}
  );
}

/**
 * What the template reads of the email's settings (ADR-0015): the email type
 * counts as a dimension, with its own precedence for the tokens its values carry.
 *
 * @param {Object} params
 * @param {Array} params.emailTypes the company's typologies
 * @param {number} [params.emailTypePrecedence]
 * @param {Array} params.dimensions
 * @param {Object} params.selections
 * @param {string} [params.emailTypeId]
 * @param {string} [params.trigger]
 * @returns {Object} template property → value
 */
function templateValuesFor({
  emailTypes,
  emailTypePrecedence,
  dimensions,
  selections,
  emailTypeId,
  trigger,
}) {
  return governanceValues({
    dimensions: [
      {
        name: 'emailType',
        precedence: emailTypePrecedence || 0,
        values: emailTypes,
      },
      ...dimensions,
    ],
    selections: { ...selections, emailType: emailTypeId },
    trigger,
  }).values;
}

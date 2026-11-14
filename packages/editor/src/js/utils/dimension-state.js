'use strict';

const {
  reconcileSelections,
  selectionsFromIds,
} = require('./dimension-selects');
const { governanceValues } = require('./governance-values');
const {
  resolveDefaults,
} = require('../../../../shared/taxonomy/default-values.js');
const { adoptValues } = require('../../../../shared/taxonomy/adoption.js');

/**
 * The state of the dimension selects of the email settings, as the Vue section
 * holds it: one key per dimension, an empty string for no value. Pure, so it is
 * tested apart: the editor has no component test harness, and anything left in
 * the plugin is untested. Covered by tests/editor/dimension-state.test.js.
 */
module.exports = {
  initialSelections,
  openingSelections,
  contentValuesOf,
  nextSelections,
  templateValuesFor,
};

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
 * The selections the section opens with (ADR-0024): what the email carries,
 * then, for an empty dimension, the value its content already holds (adoption),
 * then the defaults under what was adopted. Read before the section first
 * publishes to the content: a value the user emptied and saved is published
 * empty, and so never adopted again.
 *
 * @param {Object} params
 * @param {Array} params.dimensions
 * @param {Array} params.taxonomyItemIds the values the email carries
 * @param {Object} [params.contract] the template contract, `{ adopt }`
 * @param {Object} [params.content] the root of the email's content
 * @param {string} [params.emailTypeId]
 * @returns {{selections: Object, gaps: Object}} the gaps by dimension name,
 *   `{ identifier, reason }`: what the content held and could not be adopted
 */
function openingSelections({
  dimensions,
  taxonomyItemIds,
  contract,
  content,
  emailTypeId,
}) {
  const initial = initialSelections(dimensions, taxonomyItemIds);
  const carried = Object.keys(initial).reduce(
    (kept, name) => (initial[name] ? { ...kept, [name]: initial[name] } : kept),
    emailTypeId ? { emailType: emailTypeId } : {}
  );
  const adoption = adoptValues({
    dimensions,
    contract,
    content: contentValuesOf(content),
    selections: carried,
  });
  const filled =
    adoption.adopted.length > 0
      ? resolveDefaults({
          dimensions,
          selections: adoption.selections,
          changed: adoption.adopted,
        })
      : adoption.selections;

  return {
    selections: Object.keys(initial).reduce(
      (next, name) => ({ ...next, [name]: filled[name] || '' }),
      {}
    ),
    gaps: adoption.gaps.reduce(
      (byName, { dimension, identifier, reason }) => ({
        ...byName,
        [dimension]: { identifier, reason },
      }),
      {}
    ),
  };
}

/**
 * The root properties of an email's content as plain values: Mosaico keeps
 * each in an observable.
 *
 * @param {Object|null} content
 * @returns {Object} name → value
 */
function contentValuesOf(content) {
  if (!content) return {};
  return Object.keys(content).reduce((values, name) => {
    const property = content[name];
    if (typeof property !== 'function') return values;
    return { ...values, [name]: property() };
  }, {});
}

/**
 * The selections after a change, every key kept. A child value no longer
 * offered takes the new parent value's default (ADR-0024), or the only value
 * offered there, or is emptied rather than removed. Only the descendants of
 * `changed` are looked at, so a combination narrowed since the email chose it
 * is kept, with its notice, until the user changes its parent.
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
  const filled = changed
    ? resolveDefaults({
        dimensions,
        // The email type is a parent like any other, with its own field.
        selections: { ...kept, emailType: emailTypeId },
        changed,
      })
    : kept;
  return Object.keys(selections).reduce(
    (next, name) => ({ ...next, [name]: filled[name] || '' }),
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
 * @param {Object} [params.gaps] by dimension name, what could not be adopted
 *   when the email opened; null once the user chose in its select
 * @returns {Object} template property → value
 */
function templateValuesFor({
  emailTypes,
  emailTypePrecedence,
  dimensions,
  selections,
  emailTypeId,
  trigger,
  gaps,
}) {
  const values = governanceValues({
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
  // What the content held and could not be adopted (ADR-0024) is kept there
  // while the dimension stays empty and the gap is said under its select:
  // nothing decided it away. A value, chosen or by default, or a choice in
  // the select, and the dimension decides again.
  Object.keys(gaps || {}).forEach((name) => {
    if (gaps[name] && !(selections && selections[name])) delete values[name];
  });
  return values;
}

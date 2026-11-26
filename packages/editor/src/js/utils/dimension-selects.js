'use strict';

/**
 * The selects of the company dimensions in the email settings, one per
 * dimension the server sends, after the email type and the trigger.
 *
 * What the email carries travels as one list of value ids (`taxonomyItemIds`,
 * ADR-0032); the selects read it as `selections`, a dimension name mapped to the
 * id of its value. A value whose dimension is not on screen (deactivated since)
 * has no select, and is sent back untouched.
 *
 * Pure, like the rest of the section's helpers: the editor has no component test
 * harness. Covered by tests/editor/dimension-selects.test.js.
 */

/**
 * One select per dimension, in the order the server sent them.
 *
 * A deactivated value is offered only to the email that carries it: dropping it
 * would rewrite the email's value on the next save, the same reasoning as the
 * typology's. "Carries" means the values the email holds on the server (opened
 * with, or written by the last save), not the current selection: a user who
 * picks another value can still come back to it until they save, and no longer
 * once a save has dropped it. Its label says it is deactivated, as the
 * typology's does.
 *
 * @param {Object} params
 * @param {Array} params.dimensions emailMetadataConfig.dimensions
 * @param {Object} params.selections dimension name → value id
 * @param {Array} [params.carriedIds] the value ids the email holds on the
 *   server: opened with, then those of the last save
 * @param {function(string): string} [params.deactivatedLabel] the label of a
 *   deactivated value, from its own label
 * @returns {Array<{name: string, label: string, value: string|null, options: Array<{id: string, label: string, deactivated?: boolean}>}>}
 */
function dimensionSelects({
  dimensions,
  selections,
  carriedIds,
  deactivatedLabel,
}) {
  const carried = new Set((carriedIds || []).map(String));
  const markDeactivated = deactivatedLabel || ((label) => label);

  return (dimensions || []).map((dimension) => {
    const value = (selections && selections[dimension.name]) || null;
    const options = (dimension.values || [])
      .filter(
        (option) =>
          option.isActive ||
          carried.has(String(option.id)) ||
          // Never a select whose value is not among its options: it would show
          // blank while the email still carries the value.
          String(option.id) === value
      )
      .map((option) =>
        option.isActive
          ? { id: String(option.id), label: option.label }
          : {
              id: String(option.id),
              label: markDeactivated(option.label),
              deactivated: true,
            }
      );

    return {
      name: dimension.name,
      label: dimension.label,
      value,
      options,
    };
  });
}

/**
 * The selections the selects open with, from the ids the email carries.
 *
 * @param {Array} dimensions emailMetadataConfig.dimensions
 * @param {Array} taxonomyItemIds emailMetadata.taxonomyItemIds
 * @returns {Object} dimension name → value id
 */
function selectionsFromIds(dimensions, taxonomyItemIds) {
  const carried = new Set((taxonomyItemIds || []).map(String));
  return (dimensions || []).reduce((selections, dimension) => {
    const value = (dimension.values || []).find((option) =>
      carried.has(String(option.id))
    );
    if (value) selections[dimension.name] = String(value.id);
    return selections;
  }, {});
}

/**
 * The ids to save: the selections, plus the values of dimensions no longer on
 * screen, which the user could not have changed.
 *
 * @param {Array} dimensions emailMetadataConfig.dimensions
 * @param {Array} taxonomyItemIds the ids the email opened with
 * @param {Object} selections dimension name → value id, '' or null for none
 * @returns {string[]}
 */
function idsFromSelections(dimensions, taxonomyItemIds, selections) {
  const onScreen = new Set();
  (dimensions || []).forEach((dimension) =>
    (dimension.values || []).forEach((option) =>
      onScreen.add(String(option.id))
    )
  );
  const hidden = (taxonomyItemIds || [])
    .map(String)
    .filter((id) => !onScreen.has(id));
  const chosen = (dimensions || [])
    .map((dimension) => selections && selections[dimension.name])
    .filter(Boolean)
    .map(String);

  return hidden.concat(chosen);
}

module.exports = { dimensionSelects, selectionsFromIds, idsFromSelections };

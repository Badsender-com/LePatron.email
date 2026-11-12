'use strict';

/**
 * The selects of the company dimensions in the email settings, one per
 * dimension the server sends, after the email type and the trigger.
 *
 * What the email carries travels as one list of value ids (`taxonomyItemIds`,
 * ADR-0014); the selects read it as `selections`, a dimension name mapped to the
 * id of its value. A value whose dimension is not on screen (deactivated since)
 * has no select, and is sent back untouched.
 *
 * Pure, like the rest of the section's helpers: the editor has no component test
 * harness. Covered by tests/editor/dimension-selects.test.js.
 */

const EMAIL_TYPE = 'emailType';

/**
 * The dimensions in the order of their selects: each one right after its parent,
 * whatever the declared order. A dimension whose parent was not sent (deactivated
 * since) stands at the first level, and offers all its values.
 */
function inTreeOrder(dimensions) {
  const names = new Set(dimensions.map((dimension) => dimension.name));
  const nestedUnder = (dimension) =>
    dimension.parentName && names.has(dimension.parentName)
      ? dimension.parentName
      : null;
  const ordered = [];
  const place = (parentName) =>
    dimensions
      .filter((dimension) => nestedUnder(dimension) === parentName)
      .forEach((dimension) => {
        ordered.push(dimension);
        place(dimension.name);
      });
  place(null);
  return { ordered, nestedUnder };
}

/**
 * The parent value a dimension's values are offered under: the email type
 * chosen, the value chosen in the parent select, or none to read when the
 * dimension is not nested.
 *
 * @returns {{nested: boolean, parentValue: string|null}}
 */
function parentOf(dimension, nestedUnder, selections, emailTypeId) {
  if (dimension.parentName === EMAIL_TYPE) {
    return { nested: true, parentValue: emailTypeId || null };
  }
  const parentName = nestedUnder(dimension);
  if (!parentName) return { nested: false, parentValue: null };
  return {
    nested: true,
    parentValue: (selections && selections[parentName]) || null,
  };
}

const offeredUnder = (option, parentValue) => {
  const parentIds = (option.parentIds || []).map(String);
  return parentIds.length === 0 || parentIds.includes(String(parentValue));
};

/**
 * One select per dimension: each child right after its parent, hidden while the
 * parent has no value, offering the values available under the parent value.
 *
 * A deactivated value, or one no longer offered under the parent value, is
 * offered only to the email that carries it, and the second is flagged
 * `unavailable`: dropping it would rewrite the email's value on the next save.
 *
 * @param {Object} params
 * @param {Array} params.dimensions emailMetadataConfig.dimensions
 * @param {Object} params.selections dimension name → value id
 * @param {string} [params.emailTypeId] the email type chosen
 * @returns {Array<{name: string, label: string, value: string|null, unavailable: boolean, options: Array<{id: string, label: string}>}>}
 */
function dimensionSelects({ dimensions, selections, emailTypeId }) {
  const { ordered, nestedUnder } = inTreeOrder(dimensions || []);
  return ordered.reduce((selects, dimension) => {
    const { nested, parentValue } = parentOf(
      dimension,
      nestedUnder,
      selections,
      emailTypeId
    );
    if (nested && !parentValue) return selects;

    const value = (selections && selections[dimension.name]) || null;
    const isValue = (option) => String(option.id) === value;
    const values = dimension.values || [];
    const options = values
      .filter(
        (option) =>
          isValue(option) ||
          (option.isActive && (!nested || offeredUnder(option, parentValue)))
      )
      .map((option) => ({ id: String(option.id), label: option.label }));
    const chosen = values.find(isValue);

    selects.push({
      name: dimension.name,
      label: dimension.label,
      value,
      unavailable: Boolean(
        nested && chosen && !offeredUnder(chosen, parentValue)
      ),
      options,
    });
    return selects;
  }, []);
}

/**
 * The selections once a parent value changed: a child value still offered under
 * the new parent value stays (Belgium + French, then Canada: French stays), any
 * other is cleared, and so are the values of its own children.
 *
 * @param {Object} params
 * @param {Array} params.dimensions
 * @param {Object} params.selections
 * @param {string} [params.emailTypeId]
 * @param {string[]} [params.changed] the dimensions whose value the user just
 *   changed, `emailType` included; only their descendants are looked at, so a
 *   combination narrowed since it was chosen survives an unrelated change.
 *   Every dimension when absent.
 * @returns {Object} dimension name → value id, cleared ones left out
 */
function reconcileSelections({ dimensions, selections, emailTypeId, changed }) {
  const { ordered, nestedUnder } = inTreeOrder(dimensions || []);
  const result = { ...(selections || {}) };
  const touched = changed ? new Set(changed) : null;

  ordered.forEach((dimension) => {
    const { nested, parentValue } = parentOf(
      dimension,
      nestedUnder,
      result,
      emailTypeId
    );
    const value = result[dimension.name];
    if (!nested || !value) {
      if (!value) delete result[dimension.name];
      return;
    }
    const parentName = dimension.parentName;
    if (touched && !touched.has(parentName)) return;

    const chosen = (dimension.values || []).find(
      (option) => String(option.id) === String(value)
    );
    if (!parentValue || !chosen || !offeredUnder(chosen, parentValue)) {
      delete result[dimension.name];
      // Its children lose their parent value with it.
      if (touched) touched.add(dimension.name);
    }
  });

  return result;
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

module.exports = {
  dimensionSelects,
  reconcileSelections,
  selectionsFromIds,
  idsFromSelections,
};

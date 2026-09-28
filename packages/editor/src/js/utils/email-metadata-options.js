'use strict';

/**
 * Options of the email-metadata selects — typology and trigger — and the
 * definition shown under each one.
 *
 * Apart from email-metadata.js, which owns what the section SAVES (the form state,
 * the PATCH payload, the dates): this is what the section OFFERS, and both selects
 * follow the same rules — an explicit empty choice, a value the email points at is
 * never dropped, a description is always a string.
 *
 * Pure, like the rest of the section's helpers: the editor has no component test
 * harness. Covered by tests/editor/email-metadata-options.test.js.
 */

/**
 * Options for the typology select, with an explicit empty choice.
 *
 * An email may point at a typology that has since been deactivated: it is not in
 * the list, and dropping it silently would rewrite the email's typology on the
 * next save. It is added back, flagged, so the user sees what they have.
 *
 * @param {Array} emailTypes metadata.emailMetadataConfig.emailTypes
 * @param {string} [currentId] the typology the email points at
 * @param {string} noneLabel translated label for "no typology"
 * @param {string} [missingLabel] translated label for a deactivated typology;
 *   distinct from `noneLabel`, otherwise the select shows two identical options
 *   and the user cannot tell their email points at a withdrawn typology
 * @returns {Array<{value: string, text: string, description: string, missing?: boolean}>}
 */
function typologyOptions(emailTypes, currentId, noneLabel, missingLabel) {
  // An item with no id would become an option valued `'undefined'`: selectable,
  // and refused by the server on save with no way for the user to understand why.
  const options = (emailTypes || [])
    .filter((item) => item && (item.id || item._id))
    .map((item) => ({
      value: String(item.id || item._id),
      text: item.label,
      // The company's own definition of this typology. Carried on the option so
      // the section can show it for whichever one is selected, and hang it off
      // the option as a tooltip. Never folded into `text`: a native select shows
      // the chosen option's full text once closed, and this is a free field of up
      // to 2000 characters.
      description: item.description || '',
    }));

  if (currentId && !options.some((o) => o.value === String(currentId))) {
    options.push({
      value: String(currentId),
      text: missingLabel || noneLabel,
      description: '',
      missing: true,
    });
  }

  return [{ value: '', text: noneLabel, description: '' }].concat(
    options.filter((o) => o.value !== '')
  );
}

/**
 * Options for the trigger select, with an explicit empty choice.
 *
 * Unlike the typology, this vocabulary is closed and is not per-company: the two
 * values come from the server so the doctrine has one source, but their labels are
 * the editor's own — they are product wording, not client data.
 *
 * A value the editor has no label for is shown raw rather than dropped, on the same
 * reasoning as `typologyOptions`: silently omitting the option an email points at
 * would rewrite its trigger on the next save.
 *
 * The definition rides ALONGSIDE the label, never inside it. Folding it into the
 * option text did put it in front of someone browsing the list — but a native
 * select shows the chosen option's full text once it is closed, so the field then
 * read "Automated — decided by a rule, every time" permanently. The definition
 * belongs under the field, the same place and the same way as the typology's.
 *
 * @param {Array<string>} triggers metadata.emailMetadataConfig.triggers
 * @param {string} noneLabel translated label for "no trigger"
 * @param {function(string): string} labelFor translates one trigger value
 * @param {string} [currentValue] the trigger the email carries
 * @param {function(string): string} [descriptionFor] the short definition of one
 *   value; a value with none gets an empty string, never `undefined`
 * @returns {Array<{value: string, text: string, description: string}>}
 */
function triggerOptions(
  triggers,
  noneLabel,
  labelFor,
  currentValue,
  descriptionFor
) {
  const known = (triggers || []).filter(Boolean).map(String);

  const values =
    currentValue && !known.includes(String(currentValue))
      ? known.concat(String(currentValue))
      : known;

  return [{ value: '', text: noneLabel, description: '' }].concat(
    values.map((value) => ({
      value,
      text: labelFor(value) || value,
      description: (descriptionFor && descriptionFor(value)) || '',
    }))
  );
}

/**
 * The description of the currently selected option, or '' when there is none.
 *
 * Shared by both selects: the typology's definition comes from the company, the
 * trigger's from the editor's locales, and below the field they behave the same.
 *
 * Here rather than in the component for the reason the file header gives, and
 * because "none selected" and "selected, but no description" have to resolve to
 * the same thing: an empty hint, not the word "undefined" under the field.
 *
 * @param {Array<{value: string, description?: string}>} options
 * @param {string} value the selected option's value
 * @returns {string}
 */
function selectedDescription(options, value) {
  if (!value) return '';
  const selected = (options || []).find(
    (option) => option && String(option.value) === String(value)
  );
  return (selected && selected.description) || '';
}

module.exports = {
  typologyOptions,
  triggerOptions,
  selectedDescription,
};

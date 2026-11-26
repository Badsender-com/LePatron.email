'use strict';

const {
  STANDARD_DIMENSIONS,
} = require('../../../../shared/taxonomy/constants.js');

/**
 * What the editor publishes to the template for one email (ADR-0015): the email
 * type and each active dimension under its name, the property a template reads
 * (`_root_.audience`), valued by the identifier of the chosen value.
 *
 * Pure, like the rest of the section's helpers: the editor has no component test
 * harness. Covered by tests/editor/governance-values.test.js.
 */

/**
 * @param {Object} params
 * @param {Array} params.dimensions `{name, isActive, values: [{id, canonicalType}]}`
 * @param {Object} params.selections dimension name → chosen value id
 * @param {Array} [params.emailTypes] the email types the editor offers,
 *   `{id, canonicalType}`, published as the `emailType` dimension
 * @param {string} [params.emailTypeId] the chosen email type
 * @param {string} [params.trigger] the email's trigger
 * @returns {{values: Object, sources: Object}} `values` maps a template property
 *   to what it receives; `sources` says where a design token came from (#1359)
 */
function governanceValues({
  dimensions,
  selections,
  emailTypes,
  emailTypeId,
  trigger,
}) {
  const values = { trigger: trigger || '' };
  const chosenBy = withEmailType(selections, emailTypes, emailTypeId);

  withEmailTypeDimension(dimensions, emailTypes)
    // The server sends active dimensions only; the flag is read for the
    // dimensions it may still send deactivated.
    .filter((dimension) => dimension.isActive !== false)
    .forEach((dimension) => {
      const chosen = chosenBy[dimension.name];
      // Defined even when empty, so `_root_.audience eq 'vip'` evaluates to
      // false instead of failing.
      if (!chosen) {
        values[dimension.name] = '';
        return;
      }
      const value = (dimension.values || []).find(
        (option) => String(option.id) === String(chosen)
      );
      // A value the editor was not sent cannot be named: the template keeps what
      // it has rather than being rewritten to nothing.
      if (!value) return;
      values[dimension.name] = publishedIdentifier(value);
    });

  return { values, sources: {} };
}

// A value with no identifier is published under its id: stable, and never
// mistaken for no value at all.
function publishedIdentifier(value) {
  return value.canonicalType || String(value.id);
}

function withEmailTypeDimension(dimensions, emailTypes) {
  const list = dimensions || [];
  if (!emailTypes) return list;
  return [{ name: STANDARD_DIMENSIONS.EMAIL_TYPE, values: emailTypes }].concat(
    list
  );
}

function withEmailType(selections, emailTypes, emailTypeId) {
  const chosenBy = { ...(selections || {}) };
  if (emailTypes) chosenBy[STANDARD_DIMENSIONS.EMAIL_TYPE] = emailTypeId || '';
  return chosenBy;
}

module.exports = { governanceValues };

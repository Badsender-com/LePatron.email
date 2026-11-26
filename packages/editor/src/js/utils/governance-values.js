'use strict';

const {
  STANDARD_DIMENSIONS,
  RESERVED_TOKEN_NAMES,
  isTokenValue,
} = require('../../../../shared/taxonomy/constants.js');

/**
 * What the editor publishes to the template for one email (ADR-0015): the email
 * type, the trigger and each active dimension under its name, the property a
 * template reads (`_root_.audience`), valued by the identifier of the chosen
 * value; and the design tokens of the chosen values under their own names.
 * When two chosen values carry the same token, the dimension with the highest
 * precedence wins, and on a tie the later one in the declared order, the email
 * type in its own place in it.
 *
 * Pure, like the rest of the section's helpers: the editor has no component test
 * harness. Covered by tests/editor/governance-values.test.js.
 */

// What an identifier may hold to be published as is (ADR-0015, Consequences).
// A template may render a root property as HTML (in a `data-ko-editable`), and
// the email type's identifier has no format of its own: anything else is
// published as the value's id.
const PUBLISHABLE_IDENTIFIER = /^[A-Za-z0-9_-]+$/;

/**
 * @param {Object} params
 * @param {Array} params.dimensions `{name, isActive, precedence, values: [{id,
 *   canonicalType, tokens}]}`, in the declared order
 * @param {Object} params.selections dimension name → chosen value id
 * @param {Array} [params.emailTypes] the email types the editor offers,
 *   `{id, canonicalType, tokens}`, published as the `emailType` dimension
 * @param {string} [params.emailTypeId] the chosen email type
 * @param {number} [params.emailTypePrecedence] the email type's precedence,
 *   for the design tokens its values carry
 * @param {number} [params.emailTypePosition] where the email type sits among
 *   `dimensions` in the declared order, which breaks a tie of precedence as
 *   the taxonomy screen does; first by default
 * @param {string} [params.trigger] the email's trigger
 * @param {string[]} [params.valued] the dimensions the email has had a value
 *   for, when it opened or since (see `rememberValued`)
 * @returns {{values: Object, sources: Object}} `values` maps a template property
 *   to what it receives; `sources` says, for each token, which dimension it
 *   came from and which ones it overrode
 */
function governanceValues({
  dimensions,
  selections,
  emailTypes,
  emailTypeId,
  emailTypePrecedence,
  emailTypePosition,
  trigger,
  valued,
}) {
  const values = {};
  const carriers = [];
  const wasValued = (name) => (valued || []).includes(name);
  const chosenBy = withEmailType(selections, emailTypes, emailTypeId);

  // The trigger is one of a closed list, published as it is; with no value, the
  // same rule as a dimension.
  if (trigger) values[STANDARD_DIMENSIONS.TRIGGER] = trigger;
  else if (wasValued(STANDARD_DIMENSIONS.TRIGGER)) {
    values[STANDARD_DIMENSIONS.TRIGGER] = '';
  }

  const all = withEmailTypeDimension(dimensions, emailTypes, {
    precedence: emailTypePrecedence,
    position: emailTypePosition,
  });
  all
    // The server sends active dimensions only; the flag is read for the
    // dimensions it may still send deactivated.
    .filter((dimension) => dimension.isActive !== false)
    .forEach((dimension, index) => {
      const chosen = chosenBy[dimension.name];
      if (!chosen) {
        // An email that never had a value for the dimension writes nothing: the
        // content keeps what it holds, a template option set before the
        // dimension existed included. Emptied after it had one, it is
        // published empty: the writer cleared it.
        if (wasValued(dimension.name)) {
          values[dimension.name] = '';
        }
        return;
      }
      const value = (dimension.values || []).find(
        (option) => String(option.id) === String(chosen)
      );
      // A value the editor was not sent cannot be named: the template keeps what
      // it has rather than being rewritten to nothing.
      if (!value) return;
      values[dimension.name] = publishedIdentifier(value);
      if (value.tokens) {
        carriers.push({
          name: dimension.name,
          precedence: dimension.precedence || 0,
          index,
          tokens: value.tokens,
        });
      }
    });

  return { values, sources: resolveTokens(carriers, values, all) };
}

/**
 * Write the tokens of the chosen values into `values`, the lowest precedence
 * first so the highest is written last and wins.
 *
 * @returns {Object} token name → `{dimension, overrode}`
 */
function resolveTokens(carriers, values, dimensions) {
  // A token never shadows a dimension: `_root_.audience` stays the audience.
  // Nor a name a dimension may not take (a piece of the content the editor
  // builds, a name every object answers to), nor `locale`, the email's
  // language, which the editor publishes itself.
  const reserved = new Set([
    STANDARD_DIMENSIONS.TRIGGER,
    ...RESERVED_TOKEN_NAMES,
    ...(dimensions || []).map((dimension) => dimension.name),
  ]);
  const sources = {};

  carriers
    .sort((a, b) => a.precedence - b.precedence || a.index - b.index)
    .forEach((carrier) => {
      Object.entries(carrier.tokens).forEach(([name, token]) => {
        if (reserved.has(name)) return;
        // A value stored before the server checked its format: the template
        // keeps its own rather than receive markup or CSS (ADR-0015).
        if (!isTokenValue(token)) return;
        const previous = sources[name];
        values[name] = token;
        sources[name] = {
          dimension: carrier.name,
          overrode: previous ? [...previous.overrode, previous.dimension] : [],
        };
      });
    });

  return sources;
}

/**
 * The dimensions the email has had a value for, the email type and the
 * trigger included: those it had, plus those that have one now. Kept by the
 * section from the moment the email opens, so a dimension the writer empties
 * is published empty, and one that never had a value is not published at all.
 *
 * @param {string[]} valued the dimensions remembered so far
 * @param {Object} params
 * @param {Object} params.selections dimension name → chosen value id
 * @param {string} [params.emailTypeId] the chosen email type
 * @param {string} [params.trigger] the email's trigger
 * @returns {string[]} `valued` itself when nothing is new
 */
function rememberValued(valued, { selections, emailTypeId, trigger }) {
  const known = valued || [];
  const chosenBy = {
    ...withEmailType(selections, [], emailTypeId),
    [STANDARD_DIMENSIONS.TRIGGER]: trigger || '',
  };
  const added = Object.keys(chosenBy).filter(
    (name) => chosenBy[name] && !known.includes(name)
  );
  return added.length > 0 ? known.concat(added) : known;
}

// A value with no identifier, or one a template should not receive, is
// published under its id: stable, and never mistaken for no value at all.
function publishedIdentifier(value) {
  const identifier = value.canonicalType;
  return identifier && PUBLISHABLE_IDENTIFIER.test(identifier)
    ? identifier
    : String(value.id);
}

// The email type in its place in the declared order, the server's.
function withEmailTypeDimension(dimensions, emailTypes, { precedence, position }) {
  const list = dimensions || [];
  if (!emailTypes) return list;
  const at = Math.min(
    Math.max(Number.isInteger(position) ? position : 0, 0),
    list.length
  );
  const emailType = {
    name: STANDARD_DIMENSIONS.EMAIL_TYPE,
    precedence: precedence || 0,
    values: emailTypes,
  };
  return list.slice(0, at).concat(emailType, list.slice(at));
}

function withEmailType(selections, emailTypes, emailTypeId) {
  const chosenBy = { ...(selections || {}) };
  if (emailTypes) chosenBy[STANDARD_DIMENSIONS.EMAIL_TYPE] = emailTypeId || '';
  return chosenBy;
}

module.exports = { governanceValues, rememberValued };

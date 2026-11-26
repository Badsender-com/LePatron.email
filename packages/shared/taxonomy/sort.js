'use strict';

/**
 * The one order a company's dimensions are listed in (ADR-0032): by their
 * order, then by creation date, the first declared first.
 *
 * Shared by the server's listing, the taxonomy screen and the editor, so the
 * three never show the dimensions in different orders. The name only breaks a
 * tie the two keys leave, such as the standard dimensions seeded in one write,
 * so the order never depends on how the database happened to answer.
 *
 * No syntax that needs a Babel helper here (spread, destructuring): the UI's
 * build compiles this file, and an injected helper import would turn it into a
 * module that can no longer use `module.exports`.
 */

const orderOf = (dimension) =>
  typeof dimension.order === 'number' && Number.isFinite(dimension.order)
    ? dimension.order
    : 0;

// A date as the server stores it or as JSON carries it. A dimension without
// one comes last among its order.
const createdAtOf = (dimension) => {
  const time = dimension.createdAt
    ? new Date(dimension.createdAt).getTime()
    : NaN;
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
};

/**
 * @param {Object} a a dimension
 * @param {Object} b a dimension
 * @returns {number} for Array.prototype.sort
 */
function compareDimensions(a, b) {
  return (
    orderOf(a) - orderOf(b) ||
    createdAtOf(a) - createdAtOf(b) ||
    compareNames(String(a.name || ''), String(b.name || ''))
  );
}

// By code unit, not by locale: a name is a template property name, and the
// server and the browser must agree whatever their language.
function compareNames(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

module.exports = { compareDimensions };

'use strict';

/**
 * The literals a template compares a root property against (ADR-0026), from
 * its contract: `compared` lists `{ property, literal, count }`. One reader for
 * the server (the impact of changing an identifier) and the taxonomy
 * workspace (its Templates segment and its points to check). A contract the
 * reader has not read again yet holds no list, and compares nothing.
 */
module.exports = { comparedLiterals, comparisonsOf, comparedTogether };

const entriesOf = (contract) =>
  Array.isArray(contract?.compared) ? contract.compared : [];

/**
 * @param {Object} contract a template contract
 * @param {string} property a root property: a dimension's name
 * @returns {Array<{literal: string, count: number}>}
 */
function comparedLiterals(contract, property) {
  return entriesOf(contract)
    .filter((entry) => entry.property === property)
    .map(({ literal, count }) => ({ literal, count }));
}

/**
 * @param {Object} contract a template contract
 * @param {string} property a root property: a dimension's name
 * @param {string} literal an identifier
 * @returns {number} how many times the template compares the property to it
 */
function comparisonsOf(contract, property, literal) {
  return comparedLiterals(contract, property)
    .filter((entry) => entry.literal === literal)
    .reduce((total, entry) => total + entry.count, 0);
}

/**
 * @param {Object} contract a template contract
 * @returns {Array<{property: string, literal: string, withProperty: string, withLiteral: string, count: number}>}
 *   the comparisons made together in one expression
 */
function comparedTogether(contract) {
  return Array.isArray(contract?.comparedTogether)
    ? contract.comparedTogether
    : [];
}

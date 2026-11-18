'use strict';

const _ = require('lodash');

// The severities a rule reports, from the least to the most severe. A rule
// whose findings can have several declares them all (`levels`); otherwise its
// `severity` is its only level.
const SEVERITY_RANK = Object.freeze({ info: 0, warning: 1, error: 2 });
const rankOf = (severity) => SEVERITY_RANK[severity] || 0;

/**
 * The highest severity a rule can report: the level a blocking check blocks
 * on (ADR 0009). Read from what the rule declares, never from one run's
 * findings: a run where only a lower level fires must not block.
 * @param {Object} rule
 * @returns {string}
 */
function mostSevereLevel(rule) {
  return _.maxBy(rule.levels || [rule.severity], rankOf);
}

/**
 * Whether a finding of this severity is at the rule's most severe level. A
 * severity the rule forgot to declare, above its levels, counts as one.
 * @param {Object} rule
 * @param {string} severity
 * @returns {boolean}
 */
const isMostSevere = (rule, severity) =>
  rankOf(severity) >= rankOf(mostSevereLevel(rule));

module.exports = { mostSevereLevel, isMostSevere };

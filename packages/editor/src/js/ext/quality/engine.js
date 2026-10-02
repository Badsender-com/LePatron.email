'use strict';

const _ = require('lodash');
const ko = require('knockout');
const { getBlockLabelWithNumber } = require('../comments-utils');

const htmlSize = require('./rules/html-size');
const trackingParams = require('./rules/tracking-params');
const unfilledLinks = require('./rules/unfilled-links');
const imagesWithoutLink = require('./rules/images-without-link');
const unreplacedImages = require('./rules/unreplaced-images');
const backgroundImages = require('./rules/background-images');

// Order is the order checks are listed in; severity grouping happens in the UI.
const DEFAULT_RULES = [
  trackingParams,
  unfilledLinks,
  imagesWithoutLink,
  unreplacedImages,
  backgroundImages,
  htmlSize,
];

// djb2: enough to tell two values apart in a fingerprint, not a security hash.
function hashString(value) {
  const str = String(value === undefined || value === null ? '' : value);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * The client's blocks, from every container of the content model: the
 * converter turns `data-ko-container="x"` into `xBlocks` (converter/parser.js).
 * Fixed blocks, declared outside any container, are the template's own.
 */
function collectBlocks(viewModel) {
  const content = viewModel.content() || {};
  return _.flatMap(
    Object.keys(content).filter((key) => /Blocks$/.test(key)),
    (key) => {
      const container = ko.toJS(content[key]);
      return container && Array.isArray(container.blocks)
        ? container.blocks
        : [];
    }
  );
}

/**
 * Builds what every rule reads: the exported HTML (exported and parsed once),
 * the plain content model and a way to trace an exported node back to its block.
 */
function buildContext(viewModel, html) {
  const blocks = collectBlocks(viewModel);
  const blockIds = new Set(blocks.map((block) => block && block.id));
  // An inert document: unlike $.parseHTML, DOMParser never fetches the images.
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return {
    viewModel,
    html,
    doc,
    blocks,
    blockDefs: ko.toJS(viewModel.blockDefs) || [],
    // The block root keeps its `id` in the export (uniqueId + attr:{id}).
    // Anything outside a block root is the template's frame, not the client's.
    blockIdOf(node) {
      for (let el = node; el && el.nodeType === 1; el = el.parentElement) {
        if (el.id && blockIds.has(el.id)) return el.id;
      }
      return null;
    },
  };
}

function completeFinding(rule, finding, ctx) {
  const blockId = finding.blockId || null;
  const propertyPath = finding.propertyPath || null;
  return {
    ruleId: rule.id,
    category: rule.category,
    severity: finding.severity || rule.severity,
    messageKey: finding.messageKey,
    params: finding.params || {},
    blockId,
    blockLabel: blockId ? getBlockLabelWithNumber(ctx.blocks, blockId) : null,
    propertyPath,
    // Identifies "this issue on this content": it changes when the content
    // does, so an ignored finding comes back once the value is edited.
    fingerprint: [
      rule.id,
      blockId || '-',
      propertyPath || '-',
      hashString(finding.value),
    ].join('|'),
  };
}

const failedCheck = (rule) => ({
  ruleId: rule.id,
  category: rule.category,
  status: 'error',
});

function runRule(rule, ctx) {
  try {
    const findings = (rule.run(ctx) || []).map((f) =>
      completeFinding(rule, f, ctx)
    );
    const status = findings.length ? 'failed' : 'passed';
    return {
      findings,
      check: {
        ruleId: rule.id,
        category: rule.category,
        status,
        count: findings.length,
      },
    };
  } catch (err) {
    // One broken rule must never stop the export or the other checks.
    console.error(`Quality check "${rule.id}" failed`, err);
    return { findings: [], check: failedCheck(rule) };
  }
}

/**
 * Runs every quality check against the current email.
 * @param {Object} viewModel - the editor view model
 * @param {Object} [options]
 * @param {string} [options.html] - an already exported HTML, to avoid exporting twice
 * @param {Array} [options.rules] - rules to run instead of the default set
 * @returns {{ findings: Array, checks: Array }} findings to show, and one entry
 *   per check with its status, so passed checks can be listed too
 */
function runQualityChecks(viewModel, options = {}) {
  const html =
    typeof options.html === 'string' ? options.html : viewModel.exportHTML();
  const rules = options.rules || DEFAULT_RULES;

  let ctx;
  try {
    ctx = buildContext(viewModel, html);
  } catch (err) {
    // Download and ESP send run the checks first: a model the engine cannot
    // read must cost the checks, never the export.
    console.error('Quality checks could not read the email', err);
    return { findings: [], checks: rules.map(failedCheck) };
  }

  const results = rules.map((rule) => runRule(rule, ctx));
  return {
    findings: _.flatMap(results, 'findings'),
    checks: results.map((result) => result.check),
  };
}

module.exports = {
  runQualityChecks,
  DEFAULT_RULES,
};

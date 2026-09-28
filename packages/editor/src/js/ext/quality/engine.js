'use strict';

const _ = require('lodash');
const { getBlockLabelWithNumber } = require('../comments-utils');
const { buildContext } = require('./context');

const htmlSize = require('./rules/html-size');
const trackingParams = require('./rules/tracking-params');
const unfilledLinks = require('./rules/unfilled-links');
const imagesWithoutLink = require('./rules/images-without-link');
const unreplacedImages = require('./rules/unreplaced-images');
const backgroundImages = require('./rules/background-images');
const malformedLinks = require('./rules/malformed-links');
const displayedUrls = require('./rules/displayed-urls');
const suspiciousLinks = require('./rules/suspicious-links');
const insecureUrls = require('./rules/insecure-urls');
const unnamedImageLinks = require('./rules/unnamed-image-links');
const altTextQuality = require('./rules/alt-text-quality');
const imageOnlyEmail = require('./rules/image-only-email');
const unsupportedImageFormats = require('./rules/unsupported-image-formats');
const subject = require('./rules/subject');
const preheader = require('./rules/preheader');
const sampleText = require('./rules/sample-text');
const mergeTags = require('./rules/merge-tags');
const emptyBlocks = require('./rules/empty-blocks');
const uppercaseText = require('./rules/uppercase-text');

// Order is the order checks are listed in; severity grouping happens in the UI.
const DEFAULT_RULES = [
  subject,
  preheader,
  sampleText,
  mergeTags,
  emptyBlocks,
  uppercaseText,
  trackingParams,
  unfilledLinks,
  malformedLinks,
  displayedUrls,
  suspiciousLinks,
  imagesWithoutLink,
  unnamedImageLinks,
  unreplacedImages,
  altTextQuality,
  backgroundImages,
  unsupportedImageFormats,
  imageOnlyEmail,
  insecureUrls,
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
 * Completes what a rule returns: { messageKey, params?, severity?, blockId?,
 * propertyPath?, value? }. `value` is the offending value itself (the link
 * label, the image src, the size in KB): the fingerprint hashes it, so it must
 * change when the fault does, and only then.
 */
function completeFinding(rule, finding, ctx) {
  const blockId = finding.blockId || null;
  const propertyPath = finding.propertyPath || null;
  return {
    ruleId: rule.id,
    category: rule.category,
    titleKey: rule.titleKey,
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
  titleKey: rule.titleKey,
  status: 'error',
});

// Identical findings of one block (two "Read more" links left on #toreplace)
// would share a fingerprint: their rank among themselves tells them apart, and
// moving other blocks around leaves it alone.
function rankFingerprints(findings) {
  const ranks = new Map();
  return findings.map((finding) => {
    const rank = (ranks.get(finding.fingerprint) || 0) + 1;
    ranks.set(finding.fingerprint, rank);
    return { ...finding, fingerprint: `${finding.fingerprint}|${rank}` };
  });
}

function runRule(rule, ctx) {
  try {
    const findings = rankFingerprints(
      (rule.run(ctx) || []).map((f) => completeFinding(rule, f, ctx))
    );
    const status = findings.length ? 'failed' : 'passed';
    return {
      findings,
      check: {
        ruleId: rule.id,
        category: rule.category,
        titleKey: rule.titleKey,
        status,
        count: findings.length,
        // What a passed check says: "Every link has a destination".
        passKey: rule.passKey,
        passParams: rule.passParams ? rule.passParams(ctx) : {},
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
  // The drawer announces how many checks it runs.
  DEFAULT_RULES,
};

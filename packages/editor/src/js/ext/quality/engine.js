'use strict';

const ko = require('knockout');
const { getBlockLabelWithNumber } = require('../comments-utils');

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
const smallFont = require('./rules/small-font');
const hiddenText = require('./rules/hidden-text');
const colorContrast = require('./rules/color-contrast');
const textLayout = require('./rules/text-layout');
const indistinctLinks = require('./rules/indistinct-links');
const headings = require('./rules/headings');
const altRedundant = require('./rules/alt-redundant');
const emojiPlacement = require('./rules/emoji-placement');
const forbiddenCode = require('./rules/forbidden-code');
const malformedHtml = require('./rules/malformed-html');
const unsupportedCode = require('./rules/unsupported-code');
const looseCode = require('./rules/loose-code');

// Order is the order checks are listed in; severity grouping happens in the UI.
const DEFAULT_RULES = [
  subject,
  preheader,
  sampleText,
  mergeTags,
  emptyBlocks,
  uppercaseText,
  hiddenText,
  smallFont,
  colorContrast,
  textLayout,
  indistinctLinks,
  headings,
  altRedundant,
  emojiPlacement,
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
  forbiddenCode,
  malformedHtml,
  unsupportedCode,
  looseCode,
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
 * Builds what every rule reads: the exported HTML (exported and parsed once),
 * the plain content model and a way to trace an exported node back to its block.
 */
function buildContext(viewModel, html) {
  const blocks = ko.toJS(viewModel.content().mainBlocks().blocks) || [];
  const blockIds = new Set(blocks.map((block) => block && block.id));
  // An inert document: unlike $.parseHTML, DOMParser never fetches the images.
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return {
    viewModel,
    html,
    doc,
    blocks,
    blockDefs: ko.toJS(viewModel.blockDefs) || [],
    // Shared by the rules of one run: what they read from the export once.
    cache: {},
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
  const ctx = buildContext(viewModel, html);

  const findings = [];
  const checks = [];

  rules.forEach((rule) => {
    const check = {
      ruleId: rule.id,
      category: rule.category,
      titleKey: rule.titleKey,
    };
    let ruleFindings;
    try {
      ruleFindings = rule.run(ctx) || [];
    } catch (err) {
      // One broken rule must never stop the export or the other checks.
      console.error(`Quality check "${rule.id}" failed`, err);
      checks.push({ ...check, status: 'error' });
      return;
    }
    const completed = ruleFindings.map((f) => completeFinding(rule, f, ctx));
    findings.push(...completed);
    checks.push({
      ...check,
      status: completed.length ? 'failed' : 'passed',
      count: completed.length,
      // What a passed check says: "Every link has a destination".
      passKey: rule.passKey,
      passParams: rule.passParams ? rule.passParams(ctx) : {},
    });
  });

  return { findings, checks };
}

module.exports = {
  runQualityChecks,
  DEFAULT_RULES,
};

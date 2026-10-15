const { CATEGORY_KEYS } = require('./quality-meta');

// The rows of the quality drawer, built from what the engine returns: one per
// finding, and one per check that passed or could not run.

/**
 * @param {Array} findings - findings of the engine
 * @param {Function} t - translation
 * @returns {Array} rows carrying their finding
 */
function findingItems(findings, t) {
  const seen = {};
  return findings.map((finding) => {
    seen[finding.fingerprint] = (seen[finding.fingerprint] || 0) + 1;
    return {
      id: `${finding.fingerprint}#${seen[finding.fingerprint]}`,
      severity: finding.severity,
      title: t(finding.titleKey),
      description: t(finding.messageKey, finding.params),
      category: t(CATEGORY_KEYS[finding.category]),
      blockId: finding.blockId,
      blockLabel: finding.blockLabel,
      finding,
    };
  });
}

// What a check with no finding says of itself.
function checkDescription(check, t) {
  if (check.status === 'passed') return t(check.passKey, check.passParams);
  if (check.status === 'cancelled') return t('This check was cancelled');
  return t('This check could not run');
}

/**
 * @param {Array} checks - checks of the engine
 * @param {Function} t - translation
 * @returns {Array} rows of the checks with no finding
 */
function checkItems(checks, t) {
  return checks
    .filter((check) => check.status !== 'failed')
    .map((check) => ({
      id: `check:${check.ruleId}`,
      // A check that could not run is shown, never counted as passed.
      severity: check.status === 'passed' ? 'success' : 'not-run',
      title: t(check.titleKey),
      description: checkDescription(check, t),
      category: t(CATEGORY_KEYS[check.category]),
      blockId: null,
      blockLabel: null,
      finding: null,
    }));
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * The time of day a run happened, `HH:mm`: an absolute time stays true,
 * where "just now" would have to be refreshed.
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

module.exports = { findingItems, checkItems, formatTime };

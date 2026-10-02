'use strict';

const { readTrackingUrls } = require('../context');

/**
 * The required tracking keys (as defined by the group config) that have no
 * value among the tracking values the client filled in.
 * @param {Object} [cfg] - metadata.trackingConfig
 * @param {Array} trackingUrls - content().tracking().trackingUrls()
 * @returns {string[]}
 */
function missingRequiredKeys(cfg, trackingUrls) {
  if (!cfg || !cfg.enabled || !Array.isArray(cfg.params)) return [];
  const requiredKeys = cfg.params
    .filter((p) => p && p.required)
    .map((p) => p.key);
  if (requiredKeys.length === 0) return [];

  const filled = new Set(
    trackingUrls
      .filter((tu) => tu && tu.key && tu.value && String(tu.value).length > 0)
      .map((tu) => tu.key)
  );
  return requiredKeys.filter((k) => !filled.has(k));
}

// Download and ESP send call it directly too: a missing key blocks them.
function checkRequiredTrackingParams(viewModel) {
  return missingRequiredKeys(
    viewModel && viewModel.metadata && viewModel.metadata.trackingConfig,
    readTrackingUrls(viewModel)
  );
}

module.exports = {
  id: 'tracking-params',
  category: 'content',
  severity: 'error',
  run(ctx) {
    const missing = missingRequiredKeys(
      ctx.config.trackingConfig,
      ctx.trackingUrls
    );
    if (!missing.length) return [];
    return [
      {
        messageKey: 'Required tracking parameters missing: __keys__',
        params: { keys: missing.join(', ') },
        value: missing.join(','),
      },
    ];
  },
  checkRequiredTrackingParams,
};

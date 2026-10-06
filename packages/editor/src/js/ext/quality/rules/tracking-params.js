'use strict';

/**
 * Returns the list of required tracking keys (as defined by the group config)
 * that have no value set in vm.content().tracking().trackingUrls.
 * Download and ESP send call it directly too: a missing key blocks them.
 */
function checkRequiredTrackingParams(viewModel) {
  const cfg =
    viewModel && viewModel.metadata && viewModel.metadata.trackingConfig;
  if (!cfg || !cfg.enabled || !Array.isArray(cfg.params)) return [];
  const requiredKeys = cfg.params
    .filter((p) => p && p.required)
    .map((p) => p.key);
  if (requiredKeys.length === 0) return [];

  let trackingUrls = [];
  try {
    trackingUrls = viewModel.content().tracking().trackingUrls() || [];
  } catch (_e) {
    trackingUrls = [];
  }
  const filled = new Set(
    trackingUrls
      .filter((tu) => tu && tu.key && tu.value && String(tu.value).length > 0)
      .map((tu) => tu.key)
  );
  return requiredKeys.filter((k) => !filled.has(k));
}

module.exports = {
  id: 'tracking-params',
  category: 'content',
  severity: 'error',
  titleKey: 'Required tracking parameters',
  passKey: 'All required tracking parameters are filled in',
  run(ctx) {
    const missing = checkRequiredTrackingParams(ctx.viewModel);
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

'use strict';

/**
 * Resolve the effective tracking config for a mailing by merging:
 *   1. The group-level config (Group.trackingConfig)
 *   2. The template-level config (Wireframe.trackingConfig) which can either:
 *      - Replace the group config entirely (overrideGroupTracking: true)
 *      - Merge on top (default: template params override group params with the same key)
 *
 * Returns null when no config is active (so callers can short-circuit).
 *
 * @param {Object} group     A populated Group doc (or POJO with .trackingConfig)
 * @param {Object} template  A populated Template/Wireframe doc (or POJO with .trackingConfig)
 * @returns {Object|null}    { enabled, restrictValues, params: [{ key, values, required }] }
 */
function resolveTrackingConfig(group, template) {
  const groupCfg = normalize(group && group.trackingConfig);
  const wfCfg = normalize(template && template.trackingConfig);

  // Template explicitly opts out of inheritance (mode "replace").
  // We force restrictValues=true here because the semantics of "replace" is
  // "only my params apply" — any stray free-form value previously saved
  // (e.g. legacy utm_source/utm_medium from when the group config applied)
  // would otherwise leak back into the builder as free-form params.
  if (wfCfg && wfCfg.overrideGroupTracking) {
    if (!wfCfg.enabled) return null;
    return { ...toResolved(wfCfg), restrictValues: true };
  }

  // No group config or it's disabled → fall back to template (if enabled)
  if (!groupCfg || !groupCfg.enabled) {
    return wfCfg && wfCfg.enabled ? toResolved(wfCfg) : null;
  }

  // Group config is the base
  if (!wfCfg || !wfCfg.enabled) {
    return toResolved(groupCfg);
  }

  // Merge: template params override group params with the same key
  const mergedParams = (groupCfg.params || []).map((p) => ({ ...p }));
  (wfCfg.params || []).forEach((tplParam) => {
    const idx = mergedParams.findIndex((p) => p.key === tplParam.key);
    if (idx >= 0) mergedParams[idx] = { ...tplParam };
    else mergedParams.push({ ...tplParam });
  });

  return {
    enabled: true,
    restrictValues: Boolean(wfCfg.restrictValues || groupCfg.restrictValues),
    params: mergedParams,
  };
}

function normalize(cfg) {
  if (!cfg) return null;
  // Mongoose subdocs expose toObject(); plain objects already work.
  if (typeof cfg.toObject === 'function') return cfg.toObject();
  return cfg;
}

function toResolved(cfg) {
  return {
    enabled: Boolean(cfg.enabled),
    restrictValues: Boolean(cfg.restrictValues),
    params: (cfg.params || []).map((p) => ({
      key: p.key,
      values: Array.isArray(p.values) ? [...p.values] : [],
      required: Boolean(p.required),
    })),
  };
}

/**
 * Returns the list of param keys that are flagged as required in the resolved
 * config but have no value selected in the user's tracking data.
 *
 * @param {Object} tracking            mailing.data.tracking — has trackingUrls: [{key, value}]
 * @param {Object|null} resolvedConfig output of resolveTrackingConfig
 * @returns {String[]}                 missing required keys
 */
function validateRequiredTrackingParams(tracking, resolvedConfig) {
  if (!resolvedConfig || !resolvedConfig.enabled) return [];
  const requiredKeys = resolvedConfig.params
    .filter((p) => p.required)
    .map((p) => p.key);
  if (requiredKeys.length === 0) return [];

  const filledKeys = new Set(
    ((tracking && tracking.trackingUrls) || [])
      .filter((tu) => tu && tu.key && tu.value && tu.value.length > 0)
      .map((tu) => tu.key)
  );
  return requiredKeys.filter((k) => !filledKeys.has(k));
}

module.exports = {
  resolveTrackingConfig,
  validateRequiredTrackingParams,
};

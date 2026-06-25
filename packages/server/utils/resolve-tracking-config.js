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

  // Template explicitly opts out of inheritance (mode "replace"). The two
  // dimensions (overrideGroupTracking, restrictValues) are intentionally
  // kept independent: a user can replace the global config and still allow
  // free-form params in the builder. Any stray trackingUrls value saved
  // before the override is intentionally preserved (historical workflows:
  // edit-in-progress mailings, duplications). The user can remove leftover
  // free-form rows manually in the builder if needed.
  if (wfCfg && wfCfg.overrideGroupTracking) {
    return wfCfg.enabled ? toResolved(wfCfg) : null;
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
      lockedValues: Boolean(p.lockedValues),
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
  const requiredParams = resolvedConfig.params.filter((p) => p.required);
  if (requiredParams.length === 0) return [];

  const restrictValues = Boolean(resolvedConfig.restrictValues);
  const valueByKey = new Map(
    ((tracking && tracking.trackingUrls) || [])
      .filter((tu) => tu && tu.key && tu.value && tu.value.length > 0)
      .map((tu) => [tu.key, tu.value])
  );

  // A required param is "missing" if it has no usable value. Crucially, the
  // notion of "usable" must match what injection (resolveManagedValue) will
  // actually keep — otherwise a value that passes validation but gets dropped
  // at injection (locked, or out-of-list under restrictValues) would silently
  // vanish from the links with no error to the user.
  return requiredParams
    .filter((p) => {
      const allowed = Array.isArray(p.values) ? p.values : [];
      // Locked params are always satisfied: injection keeps the user's in-list
      // choice, or falls back to values[0] — never empty.
      if (p.lockedValues && allowed.length > 0) return false;
      const value = valueByKey.get(p.key);
      if (!value) return true;
      // Under restrictValues, only an allowed value survives injection.
      if (restrictValues && allowed.length > 0 && !allowed.includes(value)) {
        return true;
      }
      return false;
    })
    .map((p) => p.key);
}

/**
 * Validate and normalize a trackingConfig payload coming from the client
 * before it is persisted. The UI enforces these rules (non-empty/unique keys,
 * etc.) but the UI is bypassable, so the server must guarantee shape integrity:
 * an invalid config could otherwise make a mailing impossible to send (a
 * required param that can never be filled) or persist unexpected fields.
 *
 * Throws an Error with `.code = INVALID_TRACKING_CONFIG` on invalid shape.
 * Strips unknown fields and returns a clean object safe to persist.
 *
 * @param {Object} raw            the req.body trackingConfig payload
 * @param {Object} [options]
 * @param {Boolean} [options.allowOverrideGroupTracking] true for templates
 * @returns {Object}              sanitized { enabled, restrictValues, params }
 */
function sanitizeTrackingConfig(raw, options = {}) {
  const fail = (message) => {
    const err = new Error(message);
    err.code = 'INVALID_TRACKING_CONFIG';
    err.statusCode = 422;
    return err;
  };

  const cfg = raw && typeof raw === 'object' ? raw : {};
  if (cfg.params != null && !Array.isArray(cfg.params)) {
    throw fail('trackingConfig.params must be an array');
  }

  const seenKeys = new Set();
  const params = (cfg.params || []).map((p, i) => {
    if (!p || typeof p !== 'object') {
      throw fail(`trackingConfig.params[${i}] must be an object`);
    }
    const key = typeof p.key === 'string' ? p.key.trim() : '';
    if (!key) {
      throw fail(`trackingConfig.params[${i}].key is required`);
    }
    if (seenKeys.has(key)) {
      throw fail(`trackingConfig.params has a duplicate key: ${key}`);
    }
    seenKeys.add(key);

    if (p.values != null && !Array.isArray(p.values)) {
      throw fail(`trackingConfig.params[${i}].values must be an array`);
    }
    const values = (p.values || []).map((v, j) => {
      if (typeof v !== 'string') {
        throw fail(`trackingConfig.params[${i}].values[${j}] must be a string`);
      }
      return v;
    });

    const lockedValues = Boolean(p.lockedValues);
    // A locked param with no allowed value can never inject anything and a
    // required+locked param with no value can never be satisfied → reject.
    if (lockedValues && values.length === 0) {
      throw fail(`trackingConfig.params[${i}] is locked but has no value`);
    }

    return {
      key,
      values,
      required: Boolean(p.required),
      lockedValues,
    };
  });

  const sanitized = {
    enabled: Boolean(cfg.enabled),
    restrictValues: Boolean(cfg.restrictValues),
    params,
  };
  if (options.allowOverrideGroupTracking) {
    sanitized.overrideGroupTracking = Boolean(cfg.overrideGroupTracking);
  }
  return sanitized;
}

module.exports = {
  resolveTrackingConfig,
  validateRequiredTrackingParams,
  sanitizeTrackingConfig,
};

'use strict';

const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { Types } = require('mongoose');

const DashboardService = require('../dashboard/dashboard.service');
const { Integrations, Dashboards } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');
const IntegrationTypes = require('../constant/integration-type');

// Embed tokens are short-lived because they leak via URL bars / referer / logs.
// 60s is enough for the iframe to fetch the dashboard; refresh-on-render covers
// longer sessions.
const JWT_EXPIRATION_SECONDS = 60;

// Industry minimum for HS256 secret entropy. Anything shorter is brute-forceable.
const MIN_API_KEY_LENGTH = 32;

// TODO(security): replace this HTTPS-only check with a stricter host allowlist
// (env var METABASE_ALLOWED_HOSTS or per-tenant config), tracked in a follow-up
// infra PR. The current check still lets a compromised admin point apiHost at
// any HTTPS host they control; the iframe sandbox now mitigates the worst
// impact (no allow-same-origin → cannot reach window.parent in LePatron's
// origin), but blocking host exfiltration entirely needs an allowlist.
function isAllowedApiHost(apiHost) {
  if (typeof apiHost !== 'string') return false;
  try {
    const parsed = new URL(apiHost);
    return parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * Get CRM Intelligence status for a group
 * @param {string} groupId - The group ID
 * @param {Object} group - Pre-loaded group (from middleware)
 * @returns {Promise<Object>} Status object with enabled flag and dashboard count
 */
async function getStatus(groupId, group) {
  const isEnabled = group.enableCrmIntelligence === true;

  if (!isEnabled) {
    return {
      enabled: false,
      configured: false,
      dashboardCount: 0,
      integrations: [],
    };
  }

  const [integrations, dashboardCount] = await Promise.all([
    Integrations.find({
      _company: Types.ObjectId(groupId),
      type: IntegrationTypes.DASHBOARD,
      isActive: true,
    }).sort({ name: 1 }),
    Dashboards.countDocuments({
      _company: Types.ObjectId(groupId),
      isActive: true,
    }),
  ]);

  return {
    enabled: isEnabled,
    configured: integrations.length > 0 && dashboardCount > 0,
    dashboardCount,
    integrations: integrations.map((i) => ({
      id: i._id,
      name: i.name,
      provider: i.provider,
    })),
  };
}

/**
 * Get list of dashboards for a group (across all integrations)
 * @param {string} groupId - The group ID
 * @param {Object} group - Pre-loaded group (from middleware)
 * @returns {Promise<Array>} Array of dashboard objects with integration context
 */
async function getDashboards(groupId, group) {
  if (!group.enableCrmIntelligence) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED);
  }

  return DashboardService.listDashboards(groupId, { activeOnly: true });
}

/**
 * Generate a signed embed URL for a Metabase dashboard
 * @param {string} groupId - The group ID
 * @param {string} dashboardId - The dashboard MongoDB ID
 * @param {Object} group - Pre-loaded group (from middleware)
 * @param {Object} [user] - Authenticated user (for token binding); optional for
 *   backwards-compatibility but strongly recommended.
 * @returns {Promise<Object>} Object with embedUrl
 */
async function getEmbedUrl(groupId, dashboardId, group, user) {
  if (!group.enableCrmIntelligence) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED);
  }

  if (!Types.ObjectId.isValid(dashboardId)) {
    throw createError(400, ERROR_CODES.DASHBOARD_NOT_FOUND);
  }

  const dashboard = await Dashboards.findOne({
    _id: Types.ObjectId(dashboardId),
    _company: Types.ObjectId(groupId),
    isActive: true,
  }).populate('_integration');

  if (!dashboard) {
    throw createError(404, ERROR_CODES.DASHBOARD_NOT_FOUND);
  }

  const integration = dashboard._integration;

  if (!integration || !integration.isActive) {
    throw createError(404, ERROR_CODES.INTEGRATION_NOT_FOUND);
  }

  if (!integration.apiHost || !integration.apiKey) {
    throw createError(500, ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED);
  }

  // HTTPS-only: prevent a misconfigured/malicious integration from pointing at
  // an http:// host. See TODO in isAllowedApiHost for the planned allowlist.
  if (!isAllowedApiHost(integration.apiHost)) {
    throw createError(500, ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED);
  }

  const apiKey = integration.apiKey;
  // HS256 needs ≥32 bytes of entropy to resist offline brute-force.
  if (!apiKey || apiKey.length < MIN_API_KEY_LENGTH) {
    throw createError(500, ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED);
  }

  // Only send parameters the dashboard actually declares. Metabase rejects the
  // whole embed with a 400 ("Unknown parameter :user_id") when a signed param
  // is not declared on the target dashboard, so we must NOT inject user_id /
  // user_email unconditionally. A dashboard that wants row-level filtering by
  // user opts in by declaring `user_id` / `user_email` in its lockedParams;
  // we then fill those slots with the calling user's values (binding the token
  // to that user so it can't be replayed by another user in the same group).
  const lockedParams = dashboard.lockedParams || {};
  const userBoundParams = { ...lockedParams };
  if (
    Object.prototype.hasOwnProperty.call(lockedParams, 'user_id') &&
    user &&
    user.id
  ) {
    userBoundParams.user_id = String(user.id);
  }
  if (
    Object.prototype.hasOwnProperty.call(lockedParams, 'user_email') &&
    user &&
    user.email
  ) {
    userBoundParams.user_email = String(user.email);
  }

  const payload = {
    resource: { dashboard: dashboard.providerDashboardId },
    params: userBoundParams,
    exp: Math.round(Date.now() / 1000) + JWT_EXPIRATION_SECONDS,
  };

  let token;
  try {
    token = jwt.sign(payload, apiKey, { algorithm: 'HS256' });
  } catch (err) {
    throw createError(500, ERROR_CODES.EMBED_TOKEN_SIGN_FAILED);
  }

  const baseUrl = integration.apiHost.replace(/\/+$/, '');
  const embedUrl = `${baseUrl}/embed/dashboard/${token}#bordered=false&titled=true`;

  return {
    embedUrl,
    dashboardName: dashboard.name,
    integrationName: integration.name,
    expiresIn: JWT_EXPIRATION_SECONDS,
  };
}

module.exports = {
  getStatus,
  getDashboards,
  getEmbedUrl,
};

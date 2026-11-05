'use strict';

const logger = require('../utils/logger.js');
const { SecurityEvents } = require('../common/models.common.js');

/**
 * Records a security event (ADR 0008): two-factor authentication, or a
 * company's MCP access (ADR 0012). Never fails the request it records:
 * a record that cannot be written is logged instead.
 *
 * @param {Object} event
 * @param {string} event.action one of SECURITY_EVENT_ACTIONS
 *   (security-event/security-event.actions.js)
 * @param {string} [event.user] the id of the account acted on
 * @param {string} [event.actor] the id of who acted
 * @param {string} [event.group] the id of the group acted on
 * @param {string} [event.method] the verification method
 * @returns {Promise<void>}
 */
async function recordSecurityEvent(event) {
  logger.info(
    `[security-event] ${event.action} user=${event.user || '-'} actor=${
      event.actor || '-'
    } group=${event.group || '-'}`
  );
  try {
    await SecurityEvents.create(event);
  } catch (error) {
    logger.error(`[security-event] ${event.action} not recorded`, error);
  }
}

module.exports = { recordSecurityEvent };

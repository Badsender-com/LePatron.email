'use strict';

const logger = require('../utils/logger.js');
const { SecurityEvents } = require('../common/models.common.js');

/**
 * Records a security event (ADR 0008). Never fails the request it records:
 * a record that cannot be written is logged instead.
 *
 * @param {Object} event
 * @param {string} event.action one of SECURITY_ACTIONS
 * @param {string} [event.user] the id of the account acted on
 * @param {string} [event.actor] the id of who acted
 * @param {string} [event.group] the id of the group acted on
 * @param {string} [event.method] the verification method
 * @returns {Promise<void>}
 */
async function recordSecurityEvent(event) {
  logger.info(
    `[two-factor] ${event.action} user=${event.user || '-'} actor=${
      event.actor || '-'
    } group=${event.group || '-'}`
  );
  try {
    await SecurityEvents.create(event);
  } catch (error) {
    logger.error(`[two-factor] ${event.action} not recorded`, error);
  }
}

module.exports = { recordSecurityEvent };

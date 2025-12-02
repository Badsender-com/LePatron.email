'use strict';

const logger = require('../utils/logger.js');
const { Users } = require('../common/models.common.js');

/**
 * Updates session tracking information for a user after login
 * @param {Object} req - Express request object
 * @param {Object} user - User object (must have id and email)
 * @returns {Promise<void>}
 */
async function updateSessionTracking(req, user) {
  // Skip for admin users (admins can have multiple sessions)
  if (user.isAdmin) {
    return;
  }

  try {
    // Fetch the full user document to update session info
    const userDoc = await Users.findById(user.id);
    if (!userDoc) {
      logger.warn(`User document not found for session tracking: ${user.id}`);
      return;
    }

    const oldSessionId = userDoc.activeSessionId;
    const newSessionId = req.sessionID;

    // Update active session ID and metadata
    userDoc.activeSessionId = newSessionId;
    userDoc.sessionMetadata = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      loginTime: new Date(),
    };
    userDoc.lastActivity = new Date();
    await userDoc.save();

    // Log only when a session is replaced (security audit)
    if (oldSessionId && oldSessionId !== newSessionId) {
      logger.info(
        `Session replaced for user ${user.email}. Old: ${oldSessionId}, New: ${newSessionId}`
      );
    }
  } catch (error) {
    logger.error('Error updating session tracking:', error);
    // Don't throw - session tracking should not break login
  }
}

module.exports = {
  updateSessionTracking,
};

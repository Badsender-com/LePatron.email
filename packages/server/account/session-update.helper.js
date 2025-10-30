'use strict';

const { Users } = require('../common/models.common.js');
const logger = require('../utils/logger.js');

/**
 * Helper function to update user's active session ID after successful authentication
 * Can be used for both local and SAML authentication
 * DO NOT destroy old session here - that's handled by middleware on next request
 */
async function updateUserSession(req, userId) {
  try {
    // Skip session management for admin users (they can have multiple sessions)
    const user = await Users.findById(userId);
    if (!user || user.isAdmin) {
      return;
    }

    const currentSessionId = req.sessionID;
    const userDoc = await Users.findById(userId).select('+activeSessionId');

    if (userDoc) {
      const previousSessionId = userDoc.activeSessionId;

      // Update active session ID (DO NOT destroy old session here)
      // The old session will be detected and destroyed by middleware on next request
      userDoc.activeSessionId = currentSessionId;
      userDoc.lastActivity = new Date();
      userDoc.sessionMetadata = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent') || '',
        loginDate: new Date(),
      };
      await userDoc.save();

      // Log session creation/replacement event
      if (previousSessionId && previousSessionId !== currentSessionId) {
        logger.info(
          `Session replacement initiated for user ${userId}: new session ${currentSessionId}, previous session ${previousSessionId}`
        );
      } else {
        logger.info(`Session created for user ${userId}, session ${currentSessionId}`);
      }
    }
  } catch (error) {
    // Log error but don't fail the login - session management is non-critical
    logger.error('Error updating session:', error);
  }
}

module.exports = { updateUserSession };

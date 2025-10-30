'use strict';

const createError = require('http-errors');
const logger = require('../utils/logger.js');
const { Users } = require('../common/models.common.js');
const config = require('../node.config.js');

/**
 * Promise wrapper for session destruction with safety timeout
 * Prevents 60-second timeouts by ensuring response is always sent
 */
function destroySessionPromise(req) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      logger.warn('Session destruction timeout after 3 seconds');
      resolve();
    }, 3000);

    req.session.destroy((err) => {
      clearTimeout(timeout);
      if (err) {
        logger.error('Error destroying session:', err);
      }
      resolve();
    });
  });
}

/**
 * Session validation middleware
 * Validates that the current session matches the user's active session ID
 * If mismatch detected (session replacement), destroys old session and redirects with message
 */
async function sessionValidationMiddleware(req, res, next) {
  // Skip if not authenticated
  if (!req.user) {
    return next();
  }

  // Skip if admin (admins can have multiple sessions)
  if (req.user.isAdmin) {
    return next();
  }

  try {
    // Get current session ID
    const currentSessionId = req.sessionID;

    // Fetch user with active session ID (use select('+activeSessionId') to include hidden field)
    const user = await Users.findById(req.user.id).select('+activeSessionId +lastActivity');

    if (!user) {
      logger.warn(`User ${req.user.id} not found during session validation`);
      return next();
    }

    // If no active session ID is set, this is a new session or first-time login
    // Update and continue
    if (!user.activeSessionId) {
      user.activeSessionId = currentSessionId;
      user.lastActivity = new Date();
      user.sessionMetadata = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent') || '',
        loginDate: new Date(),
      };
      await user.save();
      logger.info(`Session initialized for user ${user.id}, session ${currentSessionId}`);
      return next();
    }

    // Compare current session ID with stored active session ID
    if (user.activeSessionId !== currentSessionId) {
      // Session mismatch detected - old session has been replaced
      logger.info(
        `Session mismatch for user ${user.id}: current=${currentSessionId}, active=${user.activeSessionId}`
      );

      // Set cookie with logout reason (CRITICAL: path: '/' so it's accessible on login page)
      res.cookie('logout_reason', 'session-replaced', {
        maxAge: 10000, // 10 seconds TTL
        path: '/',
        httpOnly: false, // Must be readable by client-side JavaScript
        secure: config.isProd, // HTTPS only in production
        sameSite: 'lax',
      });

      // Destroy the old session with Promise wrapper to prevent timeout
      await destroySessionPromise(req);

      // Log the session replacement event
      logger.info(`Session replaced for user ${user.id}, old session ${currentSessionId} destroyed`);

      // Redirect to login (works for both navigation and XHR errors that trigger redirect)
      return res.redirect('/account/login');
    }

    // Session matches - update lastActivity and continue
    user.lastActivity = new Date();
    await user.save({ validateBeforeSave: false }); // Skip validation for performance

    return next();
  } catch (error) {
    logger.error('Error in session validation middleware:', error);
    // On error, continue to prevent blocking valid requests
    // The session validation failure will be caught on next request
    return next();
  }
}

module.exports = sessionValidationMiddleware;

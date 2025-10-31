'use strict';

const createError = require('http-errors');
const logger = require('../utils/logger.js');
const { Users } = require('../common/models.common.js');

/**
 * Session validation middleware factory
 * Validates that the user's current session matches their active session ID
 * If not, it means they logged in from another location (session replaced)
 */
function sessionValidationMiddleware() {
  return async (req, res, next) => {
    try {
      // Skip validation if user is not authenticated
      if (!req.isAuthenticated() || !req.user) {
        return next();
      }

      // Skip validation for admin users (admins can have multiple sessions)
      if (req.user.isAdmin) {
        return next();
      }

      // Get the current session ID
      const currentSessionId = req.sessionID;

      // Fetch the user with their active session ID (hidden field, so we need to explicitly select it)
      const user = await Users.findById(req.user.id).select(
        '+activeSessionId'
      );

      if (!user) {
        // User not found, likely deleted
        return await destroySessionAndRedirect(
          req,
          res,
          'session-expired',
          'User not found'
        );
      }

      // If no active session ID is stored yet, this is the first login after migration
      // Set the current session as active and continue
      if (!user.activeSessionId) {
        user.activeSessionId = currentSessionId;
        user.lastActivity = new Date();
        await user.save();
        logger.info(`Session set as active for user ${user.email}`);
        return next();
      }

      // Check if the current session matches the active session
      if (user.activeSessionId !== currentSessionId) {
        // Session mismatch - user logged in from another location
        logger.warn(
          `Session replaced for user ${user.email} - destroying old session`
        );
        return await destroySessionAndRedirect(
          req,
          res,
          'session-replaced',
          `Session replaced for user ${user.email}`
        );
      }

      // Session is valid - update last activity timestamp
      user.lastActivity = new Date();
      await user.save();

      return next();
    } catch (error) {
      logger.error('Error in session validation middleware:', error);
      // Don't block the request if validation fails
      return next();
    }
  };
}

/**
 * Helper function to destroy session and redirect with reason
 * Uses Promise wrapper to avoid timeout issues
 */
async function destroySessionAndRedirect(req, res, reason, logMessage) {
  try {
    logger.info(`Destroying session: ${logMessage}`);

    // Set a cookie with the logout reason (10 second TTL)
    // CRITICAL: Set path: '/' so the cookie is accessible on the login page
    res.cookie('logout_reason', reason, {
      maxAge: 10000, // 10 seconds
      httpOnly: false, // Allow client-side JavaScript to read it
      path: '/', // CRITICAL: Must be '/' not the request path
    });

    // Destroy the session with Promise wrapper to avoid timeout
    await destroySessionAsync(req);

    // Redirect to login page
    return res.redirect('/account/login');
  } catch (error) {
    logger.error('Error destroying session:', error);
    // Even if destroy fails, still redirect
    return res.redirect('/account/login');
  }
}

/**
 * Promise wrapper for session destruction with timeout
 * Ensures the response is always sent (avoids 60-second timeout)
 */
function destroySessionAsync(req) {
  return new Promise((resolve) => {
    // Safety timeout (3 seconds)
    const timeoutId = setTimeout(() => {
      logger.warn('Session destruction timed out, continuing anyway');
      resolve();
    }, 3000);

    // Attempt to destroy session
    req.session.destroy((err) => {
      clearTimeout(timeoutId);
      if (err) {
        logger.error('Error destroying session:', err);
      }
      resolve();
    });
  });
}

module.exports = sessionValidationMiddleware;

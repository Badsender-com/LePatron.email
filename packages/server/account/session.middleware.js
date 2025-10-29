'use strict';

const config = require('../node.config.js');
const {
  logSessionCreated,
  logSessionDestroyed,
  logSessionReplaced,
  logSessionValidationFailed,
  logSessionError,
} = require('../utils/session.logger.js');

/**
 * Middleware to enforce unique session per user
 *
 * Runs on every authenticated request to validate that the user's
 * current session is the only active session for their account.
 *
 * Behavior:
 * - If user is not authenticated, pass through
 * - If user is admin, pass through (admins can have multiple sessions)
 * - If user's current sessionID doesn't match their activeSessionId,
 *   terminate this session and redirect to login
 * - Updates lastActivity timestamp on each request
 */
async function enforceUniqueSession(req, res, next) {
  // Skip if user is not authenticated
  if (!req.isAuthenticated() || !req.user) {
    return next();
  }

  // Skip unique session enforcement for admin users
  // Admin can work from multiple devices simultaneously
  if (req.user.isAdmin) {
    return next();
  }

  try {
    // Dynamically import to avoid circular dependency
    const { Users } = require('../common/models.common.js');

    // Fetch user with activeSessionId (which is hidden by default)
    const user = await Users.findById(req.user.id).select('+activeSessionId');

    if (!user) {
      logSessionValidationFailed({
        userId: req.user.id,
        sessionId: req.sessionID,
        reason: 'User not found in database',
      });

      return req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
          logSessionError({
            userId: req.user.id,
            sessionId: req.sessionID,
            error: 'Failed to logout after user not found',
            errorObject: err,
          });
        }
        return res.redirect('/account/login');
      });
    }

    // Check if current session matches the registered active session
    if (user.activeSessionId && user.activeSessionId !== req.sessionID) {
      // Another session exists and this one is invalid
      logSessionValidationFailed({
        userId: user.id,
        sessionId: req.sessionID,
        expectedSessionId: user.activeSessionId,
        reason: 'Session replaced by newer login',
      });

      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
          logSessionError({
            userId: user.id,
            sessionId: req.sessionID,
            error: 'Failed to logout after session validation failure',
            errorObject: err,
          });
        }

        req.session.destroy((err) => {
          if (err) {
            console.error('Session destruction error:', err);
            logSessionError({
              userId: user.id,
              sessionId: req.sessionID,
              error: 'Failed to destroy session after validation failure',
              errorObject: err,
            });
          }

          res.clearCookie('badsender.sid');

          // Redirect with explanatory message
          return res.redirect('/account/login?reason=session-replaced');
        });
      });

      // Return early to prevent further execution
      // Don't call next() - let the callback handle the redirect
      return;
    }

    // Update last activity timestamp
    user.lastActivity = new Date();
    await user.save();
  } catch (error) {
    console.error('Session verification error:', error);
    logSessionError({
      userId: req.user ? req.user.id : undefined,
      sessionId: req.sessionID,
      error: 'Unexpected error during session verification',
      errorObject: error,
    });
    // Don't block the request on errors, just log and continue
  }

  next();
}

/**
 * Hook called after successful login
 *
 * Responsibilities:
 * - Destroy the previous session from MongoDB store (if exists)
 * - Register the new session ID in the user document
 * - Record login metadata (IP, user-agent, timestamp)
 * - Log session creation and replacement events
 *
 * @param {string} authMethod - Authentication method used (local/saml)
 */
function createLoginSuccessHandler(authMethod = 'local') {
  return async function onLoginSuccess(req, res, next) {
    // Skip for admin users (they can have multiple sessions)
    if (!req.user || req.user.isAdmin) {
      return next();
    }

    try {
      // Dynamically import to avoid circular dependency
      const { Users } = require('../common/models.common.js');

      const user = await Users.findById(req.user.id).select('+activeSessionId');

      if (!user) {
        console.error('User not found after login:', req.user.id);
        logSessionError({
          userId: req.user.id,
          sessionId: req.sessionID,
          error: 'User not found after successful login',
        });
        return next();
      }

      const oldSessionId = user.activeSessionId;
      const newSessionId = req.sessionID;

      // Destroy old session in MongoDB store if it exists and is different
      if (oldSessionId && oldSessionId !== newSessionId) {
        const sessionStore = req.sessionStore;

        sessionStore.destroy(oldSessionId, (err) => {
          if (err) {
            console.error('Old session destruction error:', err);
            logSessionError({
              userId: user.id,
              sessionId: oldSessionId,
              error: 'Failed to destroy old session from store',
              errorObject: err,
            });
          } else {
            logSessionDestroyed({
              userId: user.id,
              sessionId: oldSessionId,
              reason: 'replaced',
            });
          }
        });

        // Log session replacement
        logSessionReplaced({
          userId: user.id,
          oldSessionId,
          newSessionId,
          newIp: req.ip || req.connection.remoteAddress,
          newUserAgent: req.get('user-agent'),
        });
      }

      // Register new session
      user.activeSessionId = newSessionId;
      user.sessionCreatedAt = new Date();
      user.lastActivity = new Date();
      user.lastLoginIp = req.ip || req.connection.remoteAddress;
      user.lastLoginUserAgent = req.get('user-agent');

      await user.save();

      // Log session creation
      logSessionCreated({
        userId: user.id,
        sessionId: newSessionId,
        ip: user.lastLoginIp,
        userAgent: user.lastLoginUserAgent,
        authMethod,
      });

    } catch (error) {
      console.error('Login session update error:', error);
      logSessionError({
        userId: req.user ? req.user.id : undefined,
        sessionId: req.sessionID,
        error: 'Failed to update session after login',
        errorObject: error,
      });
      // Don't block login on errors, just log and continue
    }

    next();
  };
}

/**
 * Calculate remaining session time for a user
 * @param {Date} sessionCreatedAt - When the session was created
 * @returns {Object|null} Remaining time breakdown or null if expired
 */
function getSessionTimeRemaining(sessionCreatedAt) {
  if (!sessionCreatedAt) return null;

  const now = new Date();
  const expiresAt = new Date(sessionCreatedAt.getTime() + config.session.maxAge);
  const remaining = expiresAt - now;

  if (remaining <= 0) return 0;

  return {
    milliseconds: remaining,
    days: Math.floor(remaining / (24 * 60 * 60 * 1000)),
    hours: Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)),
    minutes: Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)),
  };
}

module.exports = {
  enforceUniqueSession,
  createLoginSuccessHandler,
  getSessionTimeRemaining,
};

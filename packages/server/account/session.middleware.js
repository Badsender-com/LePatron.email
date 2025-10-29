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

  console.log('[ENFORCE_UNIQUE_SESSION] Checking session for user:', req.user.id, 'sessionID:', req.sessionID);

  try {
    // Dynamically import to avoid circular dependency
    const { Users } = require('../common/models.common.js');

    // Fetch user with activeSessionId (which is hidden by default)
    const user = await Users.findById(req.user.id).select('+activeSessionId');

    if (!user) {
      console.log('[ENFORCE_UNIQUE_SESSION] User not found:', req.user.id);
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

    console.log('[ENFORCE_UNIQUE_SESSION] User activeSessionId:', user.activeSessionId, 'current sessionID:', req.sessionID);

    // Check if current session matches the registered active session
    if (user.activeSessionId && user.activeSessionId !== req.sessionID) {
      // Another session exists and this one is invalid
      console.log('[ENFORCE_UNIQUE_SESSION] ⚠️ SESSION MISMATCH - Logging out user');
      logSessionValidationFailed({
        userId: user.id,
        sessionId: req.sessionID,
        expectedSessionId: user.activeSessionId,
        reason: 'Session replaced by newer login',
      });

      // Set a temporary cookie to pass the logout reason to the login page
      res.cookie('logout_reason', 'session-replaced', {
        maxAge: 10000, // 10 seconds, just enough to show the message
        httpOnly: false, // Allow JavaScript to read it
        secure: !require('../node.config.js').isDev,
        sameSite: 'lax',
        path: '/', // CRITICAL: Make cookie accessible on all paths, including /account/login
      });

      return req.logout((err) => {
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
          } else {
            // Log that the old session has been destroyed
            logSessionDestroyed({
              userId: user.id,
              sessionId: req.sessionID,
              reason: 'replaced',
            });
          }

          res.clearCookie('badsender.sid');

          // Redirect to login page (reason is in cookie)
          console.log('[ENFORCE_UNIQUE_SESSION] Redirecting to /account/login with logout_reason cookie');
          return res.redirect('/account/login');
        });
      });

      // Return early to prevent further execution
      return;
    }

    console.log('[ENFORCE_UNIQUE_SESSION] ✓ Session valid - updating lastActivity');
    // Update last activity timestamp
    user.lastActivity = new Date();
    await user.save();
  } catch (error) {
    console.error('Session verification error:', error);
    logSessionError({
      userId: req.user ? req.user.id : undefined,
      sessionID: req.sessionID,
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
 * - Register the new session ID in the user document
 * - Record login metadata (IP, user-agent, timestamp)
 * - Log session creation and replacement events
 *
 * Note: The old session is NOT destroyed here. It remains in MongoDB
 * so that when the old browser makes its next request, enforceUniqueSession
 * can detect the mismatch and display the appropriate UX message.
 * The old session will be destroyed by enforceUniqueSession when detected.
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

      // Log session replacement but DON'T destroy the old session yet
      // The old session must remain in MongoDB so that when the old browser
      // makes its next request, enforceUniqueSession can detect the mismatch
      // and set the logout_reason cookie for UX messaging
      if (oldSessionId && oldSessionId !== newSessionId) {
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

'use strict';

const config = require('../node.config.js');

/**
 * Session logging utility
 * Logs session lifecycle events for security monitoring and auditing
 */

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

function formatLogMessage(event, data) {
  const timestamp = new Date().toISOString();
  return {
    timestamp,
    event,
    ...data,
  };
}

function log(level, message) {
  if (!config.session.enableLogging) {
    return;
  }

  const logMethod = console[level] || console.log;

  if (typeof message === 'object') {
    logMethod(`[SESSION] [${level.toUpperCase()}]`, JSON.stringify(message));
  } else {
    logMethod(`[SESSION] [${level.toUpperCase()}] ${message}`);
  }
}

/**
 * Log session creation event
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.sessionId - Session ID
 * @param {string} params.ip - IP address
 * @param {string} params.userAgent - User agent string
 * @param {string} params.authMethod - Authentication method (local/saml)
 */
function logSessionCreated({ userId, sessionId, ip, userAgent, authMethod }) {
  const message = formatLogMessage('SESSION_CREATED', {
    userId,
    sessionId,
    ip,
    userAgent,
    authMethod: authMethod || 'local',
  });

  log(LOG_LEVELS.INFO, message);
}

/**
 * Log session destruction event
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.sessionId - Session ID
 * @param {string} params.reason - Reason for destruction (manual_logout/expired/replaced)
 */
function logSessionDestroyed({ userId, sessionId, reason }) {
  const message = formatLogMessage('SESSION_DESTROYED', {
    userId,
    sessionId,
    reason: reason || 'manual_logout',
  });

  log(LOG_LEVELS.INFO, message);
}

/**
 * Log session replacement event
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.oldSessionId - Old session ID being replaced
 * @param {string} params.newSessionId - New session ID
 * @param {string} params.newIp - IP address of new session
 * @param {string} params.newUserAgent - User agent of new session
 */
function logSessionReplaced({ userId, oldSessionId, newSessionId, newIp, newUserAgent }) {
  const message = formatLogMessage('SESSION_REPLACED', {
    userId,
    oldSessionId,
    newSessionId,
    newIp,
    newUserAgent,
  });

  log(LOG_LEVELS.WARN, message);
}

/**
 * Log session validation failure
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.sessionId - Session ID that failed validation
 * @param {string} params.expectedSessionId - Expected session ID
 * @param {string} params.reason - Reason for failure
 */
function logSessionValidationFailed({ userId, sessionId, expectedSessionId, reason }) {
  const message = formatLogMessage('SESSION_VALIDATION_FAILED', {
    userId,
    sessionId,
    expectedSessionId,
    reason,
  });

  log(LOG_LEVELS.WARN, message);
}

/**
 * Log session error
 * @param {Object} params
 * @param {string} params.userId - User ID (optional)
 * @param {string} params.sessionId - Session ID (optional)
 * @param {string} params.error - Error message
 * @param {Error} params.errorObject - Error object (optional)
 */
function logSessionError({ userId, sessionId, error, errorObject }) {
  const message = formatLogMessage('SESSION_ERROR', {
    userId,
    sessionId,
    error,
    stack: errorObject ? errorObject.stack : undefined,
  });

  log(LOG_LEVELS.ERROR, message);
}

module.exports = {
  logSessionCreated,
  logSessionDestroyed,
  logSessionReplaced,
  logSessionValidationFailed,
  logSessionError,
};

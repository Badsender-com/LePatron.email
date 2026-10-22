// Why the server ended the previous session, left in a cookie by the session
// validation (packages/server/account/session-validation.middleware.js) for
// the login page to say.
const COOKIE = 'logout_reason';

/**
 * Reads the reason once: the cookie is deleted as it is read.
 *
 * @returns {string|null} `session-replaced`, `session-expired`, or null
 */
export function takeLogoutReason() {
  if (typeof document === 'undefined') return null;
  const parts = `; ${document.cookie}`.split(`; ${COOKIE}=`);
  if (parts.length !== 2) return null;
  const reason = parts.pop().split(';').shift();
  document.cookie = `${COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  return reason || null;
}

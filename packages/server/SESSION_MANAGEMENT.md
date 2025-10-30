# Session Management Implementation

## Overview

This document describes the session management implementation for LePatron.email to address Issue #320 - Unique Login Session Management.

## Features Implemented

### 1. 14-Day Idle Timeout
- Sessions expire after 14 days of inactivity
- Each user activity (any authenticated request) resets the 14-day timer
- Configurable via `SESSION_DURATION_DAYS` environment variable
- Default: 14 days (1,209,600,000 milliseconds)

### 2. Unique Session per User
- Only one active session allowed per user account (except admin)
- When a user logs in from a new location, previous session is immediately invalidated
- Previous location receives clear message: "You have been logged out because a new session was established from another device"
- Admin users are exempt and can have multiple concurrent sessions

### 3. Session Logging
- All session lifecycle events are logged for security auditing
- Events logged:
  - `SESSION_CREATED` - when user logs in
  - `SESSION_DESTROYED` - when session ends (logout, expiration, replacement)
  - `SESSION_REPLACED` - when new login invalidates old session
  - `SESSION_VALIDATION_FAILED` - when session validation fails
  - `SESSION_ERROR` - when errors occur during session operations
- Configurable via `SESSION_LOGGING` environment variable

### 4. Enhanced Logout
- Properly destroys session from MongoDB store
- Clears session cookie from browser
- Clears activeSessionId in user document
- Logs session destruction event

### 5. SAML Support
- Same session rules apply to SAML-authenticated users
- Session management hooks integrated into SAML callback route

## Configuration

### Environment Variables

```bash
# Session duration in days (default: 14)
SESSION_DURATION_DAYS=14

# Enable/disable session logging (default: true)
SESSION_LOGGING=true

# Existing session secret (already configured)
SESSION_SECRET=3MYdqy0lZZz2TXCr7YlxT9N6

# Database connection (already configured)
DATABASE_URL=mongodb://localhost:27017/lepatron
```

### Session Cookie Settings

```javascript
{
  maxAge: 14 days (configurable),
  httpOnly: true,  // XSS protection
  secure: true (production only),  // HTTPS enforcement
  sameSite: 'lax',  // CSRF protection
}
```

## Files Created

1. **`packages/server/utils/session.logger.js`**
   - Centralized logging utility for session events
   - Functions: `logSessionCreated`, `logSessionDestroyed`, `logSessionReplaced`, `logSessionValidationFailed`, `logSessionError`

2. **`packages/server/account/session.middleware.js`**
   - `enforceUniqueSession` - Middleware that runs on every authenticated request
   - `createLoginSuccessHandler` - Factory function for login success hooks
   - `getSessionTimeRemaining` - Utility to calculate remaining session time

3. **`packages/server/migrations/add-session-fields.js`**
   - Database migration script to add session fields to existing users
   - Run with: `node packages/server/migrations/add-session-fields.js`

4. **`packages/server/SESSION_MANAGEMENT.md`**
   - This documentation file

5. **`packages/ui/plugins/axios-interceptor.js`**
   - Axios response interceptor to handle 401 Unauthorized errors
   - Prevents infinite redirect loops when parallel XHR requests fail
   - Redirects to login page where logout_reason cookie is checked

## Files Modified

1. **`packages/server/node.config.js`**
   - Added `config.session` object with `durationDays`, `enableLogging`, and `maxAge` properties

2. **`packages/server/index.js`**
   - Updated session middleware configuration with cookie settings and `rolling: true`
   - Added session store error handling
   - Integrated `enforceUniqueSession` middleware after passport initialization
   - Enhanced `/account/logout` route to properly destroy sessions
   - Added `createLoginSuccessHandler` to `/account/login/admin/` route
   - Added `createLoginSuccessHandler` to `/SAML-login/callback` route

3. **`packages/server/user/user.schema.js`**
   - Added session tracking fields:
     - `activeSessionId` (String, select: false, hidden from API)
     - `sessionCreatedAt` (Date)
     - `lastActivity` (Date)
     - `lastLoginIp` (String)
     - `lastLoginUserAgent` (String)

4. **`packages/server/user/user.controller.js`**
   - Modified `login` function to call session management hook after successful authentication

5. **`nuxt.config.js`**
   - Added axios-interceptor plugin to handle 401 responses globally

6. **`packages/ui/routes/account/login/index.vue`**
   - Added `mounted()` hook to check for `logout_reason` cookie
   - Displays session replacement message when appropriate
   - Helper methods: `getCookie()`, `deleteCookie()`

7. **`packages/ui/helpers/locales/en.js` & `fr.js`**
   - Added translations for session replacement message
   - `global.errors.session.replaced` in English and French

8. **`packages/ui/routes/mailings/__partials/workspace-tree.vue`**
   - Fixed workspace/folder selection restoration after login
   - Added guard in `restoreSelectedNode()` to prevent premature localStorage clearing
   - Added `checkIfNotData()` call as fallback to ensure workspace is selected

## Database Schema Changes

New fields added to User collection:

```javascript
{
  activeSessionId: String,        // Current valid session ID (null if none)
  sessionCreatedAt: Date,          // When current session was created
  lastActivity: Date,              // Last user activity timestamp
  lastLoginIp: String,             // IP address of last login
  lastLoginUserAgent: String,      // User agent of last login
}
```

## Migration

Before deploying, run the migration script:

```bash
node packages/server/migrations/add-session-fields.js
```

This will add the session fields to all existing users with default values:
- `activeSessionId`: null
- `sessionCreatedAt`: null
- `lastActivity`: current date
- `lastLoginIp`: null
- `lastLoginUserAgent`: null

## How It Works

### Normal Login Flow

1. User submits login credentials
2. Passport authenticates user
3. `createLoginSuccessHandler` is called:
   - Destroys old session from MongoDB store (if exists)
   - Registers new session ID in user document
   - Records login metadata (IP, user-agent, timestamp)
   - Logs `SESSION_CREATED` event
4. User is redirected to application

### Session Validation on Each Request

1. User makes any authenticated request
2. `enforceUniqueSession` middleware runs:
   - Checks if user is authenticated (if not, pass through)
   - Checks if user is admin (if yes, pass through - admins exempt)
   - Fetches user's `activeSessionId` from database
   - Compares with current session ID
   - If mismatch:
     - Sets `logout_reason=session-replaced` cookie (10 second TTL)
     - Destroys session from MongoDB
     - Clears `badsender.sid` cookie
     - Redirects to `/account/login`
     - Login page detects cookie and displays message
   - If match:
     - Updates `lastActivity` timestamp
     - Continues with request

### Race Condition Handling (Parallel XHR Requests)

When a session is invalidated, multiple parallel XHR requests may receive 401 errors:

1. User with invalidated session clicks on folder/workspace
2. Multiple XHR requests fire simultaneously (GET folder, GET has-access, etc.)
3. First request detects session mismatch, destroys session, returns 302 redirect
4. Subsequent requests receive 401 Unauthorized (session already destroyed)
5. `axios-interceptor.js` catches all 401 errors:
   - Uses `isRedirecting` flag to prevent multiple redirects
   - Performs single `window.location.href = '/account/login'` redirect
   - This stops all pending XHR requests and navigates to login
6. Login page reads `logout_reason` cookie and displays message

### Logout Flow

1. User clicks logout
2. `/account/logout` route handler:
   - Clears `activeSessionId` in user document
   - Logs `SESSION_DESTROYED` event
   - Calls `req.logout()` to clear Passport data
   - Calls `req.session.destroy()` to remove from MongoDB
   - Clears `badsender.sid` cookie
   - Redirects to login page

### Session Expiration

1. User is inactive for 14 days
2. Session cookie expires in browser
3. MongoDB TTL index automatically removes expired session
4. Next request results in authentication failure
5. User is redirected to login page

## Security Features

1. **XSS Protection**: `httpOnly: true` prevents JavaScript access to cookies
2. **CSRF Protection**: `sameSite: 'lax'` prevents cross-site request forgery
3. **HTTPS Enforcement**: `secure: true` in production ensures cookies only sent over HTTPS
4. **Session Hijacking Mitigation**: Short session lifetime limits exposure window
5. **Concurrent Access Prevention**: Unique session prevents credential sharing
6. **Audit Trail**: Comprehensive logging enables security monitoring
7. **Admin Exemption**: Hardcoded admin account exempt from unique session (can work from multiple locations)

## Testing

### Manual Testing Checklist

- [x] **Test 1: Session replacement with UX message**
  - Login from Browser A, then Browser B
  - Verify Browser A is logged out with message
  - Test both clicking on email (navigation) and clicking on folder/workspace (XHR)
  - Verify no infinite loops or UI freezing

- [x] **Test 2: Admin multi-session exemption**
  - Login as admin from Browser A, then Browser B
  - Verify both browsers remain functional
  - Verify no logout or session replacement occurs

- [x] **Test 3: 14-day idle timeout**
  - Temporarily reduce timeout to 10 seconds for testing
  - Wait 11 seconds without activity
  - Verify automatic logout on next action
  - Restore timeout to 14 days

- [x] **Test 4: Rolling session (idle timeout behavior)**
  - Verified during Test 3
  - Activity before timeout extends session
  - `lastActivity` updates on each request

- [ ] **Test 5: SAML login** (skipped - not applicable to this deployment)

- [ ] **Post-deployment**: Run migration script in production
- [ ] **Post-deployment**: Verify all events are logged correctly

### Automated Testing

Integration tests should cover:
1. Session creation and validation
2. Unique session enforcement
3. Admin exemption
4. Session expiration
5. Logout cleanup
6. SAML authentication session management

## Troubleshooting

### Users Report Unexpected Logouts

**Check:**
1. Are they logging in from multiple devices? (This is expected behavior)
2. Is session duration too short? (Adjust `SESSION_DURATION_DAYS`)
3. Check session logs for `SESSION_REPLACED` events

### Sessions Not Expiring

**Check:**
1. Is `rolling: true` set in session config? (It should be for idle timeout)
2. Is `cookie.maxAge` configured correctly?
3. Check MongoDB TTL index on sessions collection

### Admin Can't Use Multiple Devices

**Check:**
1. Verify `user.isAdmin` property is true
2. Check if admin exemption logic is working in `enforceUniqueSession`

### Session Logs Not Appearing

**Check:**
1. Is `SESSION_LOGGING` environment variable set to `true`?
2. Is `config.session.enableLogging` true?

## Performance Considerations

- Each authenticated request performs one MongoDB query to validate session
- This is a lightweight query on `_id` (indexed by default)
- For high-traffic applications, consider adding Redis caching layer
- Session logging writes to console (consider external logging service for production)

## Future Enhancements

1. **Session Management API**: Endpoint to view active sessions and manually terminate
2. **Email Notifications**: Notify users when new login occurs from different location
3. **Session History**: Track all login/logout events for user's account history
4. **IP Whitelist**: Allow multiple sessions from trusted IP ranges
5. **Device Fingerprinting**: More sophisticated session validation beyond sessionId
6. **Hybrid Timeout**: Combine idle timeout with absolute maximum session duration

## References

- Issue #320: https://github.com/Badsender-com/LePatron.email/issues/320
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- Express-session documentation: https://github.com/expressjs/session
- Connect-mongodb-session: https://github.com/mongodb-js/connect-mongodb-session

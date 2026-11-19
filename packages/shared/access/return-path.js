'use strict';

// Where the login may send a user back once signed in, read by the login page
// and by the SAML callback: the consent page of a connected application
// (ADR 0012), and nothing else, so a link cannot make the login an open
// redirection.
//
// Same constraints as roles.js: no syntax that needs a Babel helper.

const RETURN_PATH = /^\/oauth\/consent\/[\w-]+$/;

function isReturnPath(path) {
  return typeof path === 'string' && RETURN_PATH.test(path);
}

// Where the SAML callback sends the user: the path its identity provider sent
// back (RelayState, the only thing a cross-site POST carries), else the one
// the session kept, if either is a return path.
function samlReturnPath(relayState, sessionPath) {
  if (isReturnPath(relayState)) return relayState;
  return isReturnPath(sessionPath) ? sessionPath : undefined;
}

module.exports = { isReturnPath: isReturnPath, samlReturnPath: samlReturnPath };

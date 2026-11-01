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

module.exports = { isReturnPath: isReturnPath };

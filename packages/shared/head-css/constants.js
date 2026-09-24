'use strict';

// Shared between the editor bundle and the server, which both enforce it.
//
// Unlike the HTML code block — whose constants are duplicated server-side and
// kept in step by a test, because the server must not depend on a browser
// bundle — head CSS already has a module both sides require
// (packages/shared/head-css/inject-head-css.js). One definition, no drift.
//
// A stylesheet is far more compact than the markup it styles. This bound is
// generous for responsive email CSS and keeps the stored copy — doubled by
// `previewHtml` in the same document — negligible against Mongo's 16MB limit.
const HEAD_CSS_MAX_LENGTH = 20000;

module.exports = { HEAD_CSS_MAX_LENGTH };

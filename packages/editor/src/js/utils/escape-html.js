'use strict';

// jQuery UI's button writes its label with `.html()`: a label typed by a
// company admin must reach it escaped, or it runs in every editor of the
// company. Without the DOM, so that the tests can run it.
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * @param {*} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

module.exports = { escapeHtml };

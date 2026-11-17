'use strict';

// jQuery UI's button writes its label with `.html()`: a name typed by a tech
// admin must reach it escaped, or it runs in every editor of the company.
// Without the DOM, so that the tests can run it.
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * The image hosts of the export menu (ADR 0028), each with the label its
 * button shows.
 * @param {Array<{ id: string, name: string }>} hosts
 * @returns {Array<{ id: string, name: string, label: string }>}
 */
function imageHostMenuItems(hosts) {
  return (hosts || []).map((host) => ({
    id: host.id,
    name: host.name,
    label: escapeHtml(host.name),
  }));
}

module.exports = { imageHostMenuItems, escapeHtml };

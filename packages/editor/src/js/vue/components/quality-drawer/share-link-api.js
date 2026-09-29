'use strict';

const axios = require('axios');

// The email's preview links (/api/mailings/:id/share-links, see
// share-link.controller.js). Only creation returns a link's address: the
// server keeps a hash of its token, nothing it could show again.

const listShareLinks = (url) =>
  axios.get(url).then((response) => response.data.items);

const createShareLink = (url, expiresInDays) =>
  axios.post(url, { expiresInDays }).then((response) => response.data);

const revokeShareLink = (url, id) =>
  axios.delete(`${url}/${encodeURIComponent(id)}`);

/**
 * Copies a text; resolves to whether it worked. The Clipboard API needs a
 * secure context, which a plain-http development server is not: the older
 * way, through a selected field, covers it.
 */
function copyText(text, field) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false
    );
  }
  try {
    field.select();
    return Promise.resolve(document.execCommand('copy'));
  } catch (e) {
    return Promise.resolve(false);
  }
}

module.exports = { listShareLinks, createShareLink, revokeShareLink, copyText };

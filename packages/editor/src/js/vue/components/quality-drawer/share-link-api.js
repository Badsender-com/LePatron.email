'use strict';

const axios = require('axios');

// The email's preview links (/api/mailings/:id/share-links, see
// share-link.controller.js). The list gives the address of the links it
// can show again (`copyable`): the server keeps their token encrypted.

const listShareLinks = (url) =>
  axios.get(url).then((response) => response.data.items);

const createShareLink = (url, expiresInDays) =>
  axios.post(url, { expiresInDays }).then((response) => response.data);

const revokeShareLink = (url, id) =>
  axios.delete(`${url}/${encodeURIComponent(id)}`);

/**
 * Copies a text; resolves to whether it worked. The Clipboard API needs a
 * secure context, which a plain-http development server is not, and can
 * refuse (permission, focus lost): the older way, through a selected field,
 * is tried whenever it did not do the job.
 */
function copyText(text, field) {
  const throughField = () => {
    try {
      field.select();
      return document.execCommand('copy');
    } catch (e) {
      return false;
    }
  };
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    window.isSecureContext
  ) {
    return navigator.clipboard.writeText(text).then(() => true, throughField);
  }
  return Promise.resolve(throughField());
}

module.exports = { listShareLinks, createShareLink, revokeShareLink, copyText };

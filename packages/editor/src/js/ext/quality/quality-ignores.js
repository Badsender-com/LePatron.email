'use strict';

const axios = require('axios');

// The findings the team chose to ignore: stored on the email
// (PATCH /mailings/:id/quality-ignores) and shared by everyone who edits it.
// A change shows at once, is stored in the background, and is put back as it
// was when storing fails.

// Stores one "ignore" change; resolves with the fingerprints the server keeps.
function patchIgnore(url, change) {
  return axios
    .patch(url, change)
    .then((response) => response.data.qualityIgnores);
}

/**
 * @param {Object} options
 * @param {Object} options.ko - knockout
 * @param {string} [options.url] - the endpoint; without it nothing can be ignored
 * @param {string[]} [options.initial] - the fingerprints already ignored
 * @param {Function} [options.persist] - injectable for tests
 * @param {Function} [options.onError] - told when storing fails
 */
function createIgnores({
  ko,
  url,
  initial = [],
  persist = patchIgnore,
  onError,
}) {
  const ignored = ko.observableArray(initial.slice());
  const has = (fingerprint) => ignored.indexOf(fingerprint) !== -1;

  // The server rewrites the list with each answer. Two clicks in a row are
  // sent one after the other, and the list the server keeps is taken as the
  // truth only once nothing is pending: an earlier answer would otherwise
  // erase a later click for a moment, or for good.
  let queue = Promise.resolve();
  let pending = 0;

  function set(finding, value) {
    const { fingerprint } = finding;
    if (!url || value === has(fingerprint)) return Promise.resolve();
    if (value) ignored.push(fingerprint);
    else ignored.remove(fingerprint);

    pending++;
    const request = queue
      .then(() => persist(url, { fingerprint, ignored: value }))
      .then(
        (kept) => {
          pending--;
          if (pending === 0 && Array.isArray(kept)) ignored(kept);
        },
        (err) => {
          pending--;
          if (value) ignored.remove(fingerprint);
          else ignored.push(fingerprint);
          if (onError) onError(err);
        }
      );
    queue = request;
    return request;
  }

  return {
    ignored,
    has,
    set,
    // Without the endpoint, "Ignore" would show and store nothing.
    canIgnore: Boolean(url),
  };
}

module.exports = { createIgnores, patchIgnore };

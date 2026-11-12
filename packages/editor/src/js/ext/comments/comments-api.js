'use strict';

const $ = require('jquery');

/**
 * The comment routes the comments' state reads, as promises: the list of an
 * email's comments, and the counters loaded before it (per block, and the
 * unresolved count).
 *
 * @param {Object} options
 * @param {string} options.apiBaseUrl
 * @param {string} options.mailingId
 */
function createCommentsApi({ apiBaseUrl, mailingId }) {
  const base = `${apiBaseUrl}/mailings/${mailingId}/comments`;
  const get = (url) =>
    new Promise((resolve, reject) => {
      $.ajax({ url, method: 'GET', success: resolve, error: reject });
    });
  return {
    list: () =>
      get(base).then((response) =>
        ((response && response.items) || []).map(normalizeComment)
      ),
    counts: () => get(`${base}/counts`).then((response) => normalized(response)),
    unresolvedCount: () =>
      get(`${base}/unresolved-count`).then(
        (response) => (response && response.count) || 0
      ),
  };
}

// A comment always has the fields the panel reads: one stored without a
// block, a decision or a parent comes back without them, and a Knockout
// binding reading a missing name throws.
function normalizeComment(comment) {
  return { blockId: null, decision: null, _parentComment: null, ...comment };
}

// A count per block is `{ count, maxSeverity }`; an older answer gave a bare
// number.
function normalized(response) {
  const counts = (response && response.counts) || {};
  return Object.keys(counts).reduce((byBlock, blockId) => {
    const value = counts[blockId];
    byBlock[blockId] =
      typeof value === 'object' ? value : { count: value, maxSeverity: 'info' };
    return byBlock;
  }, {});
}

module.exports = { createCommentsApi, normalizeComment };

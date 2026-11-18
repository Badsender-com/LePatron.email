'use strict';

/**
 * What the comments panel writes (ADR 0020): a comment, a reply or an
 * approval, an edit, a deletion, a resolution and its undoing. Each request
 * goes to the server, then the store takes the comment as the server answered
 * it, and the user is told. A refusal says why when the server says it.
 *
 * Each returns a promise that rejects on a failure, once the user is told:
 * the panel keeps what was written.
 */

// What the user is told when the server refuses a new comment: an approval
// over an open blocking comment, or by someone who may not approve, says why.
const CREATE_ERROR_KEYS = {
  COMMENT_APPROVAL_BLOCKED: 'comments-approve-blocked',
  COMMENT_APPROVAL_FORBIDDEN: 'comments-approve-forbidden',
};

function createErrorKey(xhr) {
  const code = xhr && xhr.responseJSON && xhr.responseJSON.message;
  return Object.prototype.hasOwnProperty.call(CREATE_ERROR_KEYS, code)
    ? CREATE_ERROR_KEYS[code]
    : 'comments-create-error';
}

/**
 * @param {Object} options
 * @param {Function} options.ajax - jQuery's
 * @param {Object} options.store - the comments' store
 * @param {string} options.apiBaseUrl
 * @param {string} options.mailingId
 * @param {Function} options.notifier - () => { success, error }
 * @param {Function} options.t
 * @param {Function} [options.confirm] - asks before a deletion
 * @param {Function} [options.announce] - says a success where it shows, and
 *   returns true; the notifier says it otherwise
 */
function createCommentsActions({
  ajax,
  store,
  apiBaseUrl,
  mailingId,
  notifier,
  t,
  confirm = (message) => window.confirm(message),
  announce = () => false,
}) {
  const commentUrl = (id) => `${apiBaseUrl}/comments/${encodeURIComponent(id)}`;
  // Before the list loads, the counters come from the server: ask again.
  const recount = () => {
    if (!store.listLoaded()) store.start();
  };

  function request(options, { done, failed, success }) {
    return new Promise((resolve, reject) => {
      ajax({
        contentType: 'application/json',
        ...options,
        data: options.data ? JSON.stringify(options.data) : undefined,
        // An answer the store cannot take still settles the request.
        success(answer) {
          try {
            success(answer);
            if (done && !announce(t(done))) notifier().success(t(done));
            resolve(answer);
          } catch (error) {
            reject(error);
          }
        },
        error(xhr) {
          notifier().error(t(typeof failed === 'function' ? failed(xhr) : failed));
          reject(xhr);
        },
      });
    });
  }

  return {
    /**
     * @param {{ text, category, severity, decision?, blockId?,
     *   parentCommentId?, mentions? }} comment
     */
    create(comment) {
      return request(
        {
          url: `${apiBaseUrl}/mailings/${encodeURIComponent(mailingId)}/comments`,
          method: 'POST',
          data: comment,
        },
        {
          done: 'comments-created',
          failed: createErrorKey,
          success: (created) => {
            store.upsert(created);
            recount();
          },
        }
      );
    },
    // The text and the mentions it holds, as at its creation.
    update(comment, text, mentions) {
      return request(
        {
          url: commentUrl(comment._id),
          method: 'PATCH',
          data: mentions ? { text, mentions } : { text },
        },
        {
          done: 'comments-updated',
          failed: 'comments-update-error',
          success: (updated) => store.upsert(updated),
        }
      );
    },
    // Asks first; a withdrawn approval is said as such.
    remove(comment) {
      const approval = comment.decision === 'approved';
      if (!confirm(t(approval ? 'comments-withdraw-confirm' : 'comments-delete-confirm'))) {
        return Promise.resolve(false);
      }
      return request(
        { url: commentUrl(comment._id), method: 'DELETE' },
        {
          done: approval ? 'comments-withdrawn' : 'comments-deleted',
          failed: 'comments-delete-error',
          success: () => {
            store.remove(comment._id);
            recount();
          },
        }
      );
    },
    resolve(comment) {
      return request(
        { url: `${commentUrl(comment._id)}/resolve`, method: 'PATCH' },
        {
          done: 'comments-resolved',
          failed: 'comments-resolve-error',
          success: (updated) => {
            store.upsert(updated);
            recount();
          },
        }
      );
    },
    unresolve(comment) {
      return request(
        { url: `${commentUrl(comment._id)}/unresolve`, method: 'PATCH' },
        {
          done: 'comments-unresolved',
          failed: 'comments-unresolve-error',
          success: (updated) => {
            store.upsert(updated);
            recount();
          },
        }
      );
    },
  };
}

module.exports = { createCommentsActions, createErrorKey };

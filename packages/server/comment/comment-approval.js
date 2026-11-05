'use strict';

const { BadRequest, Conflict, Forbidden } = require('http-errors');

const { Comments } = require('../common/models.common.js');
const {
  COMMENT_DECISIONS,
  OPEN_BLOCKING_ROOT_COMMENTS,
} = require('./comment.schema.js');
const ERROR_CODES = require('../constant/error-codes.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');

/**
 * The rules of an approval (ADR 0020): an event of the thread, by
 * mailing.approve, never over an open blocking comment, without type,
 * priority or block, neither resolved nor reopened.
 */

/** @param {?string} decision a comment's decision */
const isApproval = (decision) => decision === COMMENT_DECISIONS.APPROVED;

/**
 * @param {Object} user the request user
 * @throws {Forbidden} COMMENT_APPROVAL_FORBIDDEN without mailing.approve
 */
function assertCanApprove(user) {
  if (!permissions.can(user, CAPABILITIES.MAILING_APPROVE)) {
    throw new Forbidden(ERROR_CODES.COMMENT_APPROVAL_FORBIDDEN);
  }
}

/**
 * No approval while a root comment, not an approval, is unresolved and
 * blocking. A reply may carry a priority but is never counted. The
 * computation of "approved" holds the same rule, for what this check cannot
 * see: a blocking comment reopened or posted after it.
 *
 * @param {string} mailingId
 * @throws {Conflict} COMMENT_APPROVAL_BLOCKED
 */
async function assertNoOpenBlocking(mailingId) {
  const openBlocking = await Comments.countDocuments({
    _mailing: mailingId,
    ...OPEN_BLOCKING_ROOT_COMMENTS,
  });
  if (openBlocking > 0) {
    throw new Conflict(ERROR_CODES.COMMENT_APPROVAL_BLOCKED);
  }
}

/**
 * An approval's text only changes, by someone who may still approve.
 *
 * @param {Object} comment the stored comment
 * @param {Object} user the request user
 * @param {Object} updates the requested changes
 * @throws {BadRequest} COMMENT_APPROVAL_FIXED, {Forbidden}
 */
function assertApprovalUpdate(comment, user, updates) {
  if (!isApproval(comment.decision)) return;
  if (updates.category !== undefined || updates.severity !== undefined) {
    throw new BadRequest(ERROR_CODES.COMMENT_APPROVAL_FIXED);
  }
  assertCanApprove(user);
}

/**
 * An approval is an event, not a comment to resolve or reopen.
 *
 * @param {Object} comment the stored comment
 * @throws {BadRequest} COMMENT_APPROVAL_FIXED
 */
function assertNotApproval(comment) {
  if (isApproval(comment.decision)) {
    throw new BadRequest(ERROR_CODES.COMMENT_APPROVAL_FIXED);
  }
}

module.exports = {
  isApproval,
  assertCanApprove,
  assertNoOpenBlocking,
  assertApprovalUpdate,
  assertNotApproval,
};

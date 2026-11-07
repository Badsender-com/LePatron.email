'use strict';

/**
 * What the comments panel shows, out of the comments (ADR 0020), as plain
 * functions: the thread in its order, the approvals as events, what lifted
 * an approval, and a comment's text cut into pieces Vue renders without
 * markup.
 */

const APPROVED = 'approved';
const MENTION = /@\[([^\]]+)\]\([a-f0-9]+\)/g;

const isRoot = (c) => !c._parentComment;
const isApproval = (c) => c.decision === APPROVED;
const timeOf = (c) => new Date(c.createdAt || 0).getTime();
const newestFirst = (a, b) => timeOf(b) - timeOf(a);
const authorOf = (c) =>
  c.authorName || (c._author && c._author.name) || null;

/**
 * The thread of the panel, newest first: the open comments and the
 * approvals, then the resolved comments, folded under their count. A filter
 * on a block keeps that block's comments; the approvals concern the whole
 * email and stay out of it.
 *
 * @param {Array} comments - every comment known, replies included
 * @param {string|null} filter - the block id read, or null for all
 * @returns {{ items: Array, resolved: Array, repliesOf: Function }}
 */
function threadOf(comments, filter = null) {
  const roots = comments.filter(isRoot);
  const shown = roots
    .filter((c) => (filter ? !isApproval(c) && c.blockId === filter : true))
    .sort(newestFirst);
  const replies = {};
  comments
    .filter((c) => !isRoot(c))
    .forEach((c) => {
      (replies[c._parentComment] = replies[c._parentComment] || []).push(c);
    });
  Object.keys(replies).forEach((id) =>
    replies[id].sort((a, b) => timeOf(a) - timeOf(b))
  );
  return {
    // An approval stays in the thread, resolved or not: it is an event.
    items: shown.filter((c) => !c.resolved || isApproval(c)),
    resolved: shown.filter((c) => c.resolved && !isApproval(c)),
    repliesOf: (id) => replies[id] || [],
  };
}

/**
 * Whether the email is approved, and why an approval no longer holds: the
 * last root comment is an approval and no blocking comment is open
 * (ADR 0004, amended by ADR 0020).
 *
 * @param {Array} comments
 * @returns {{ approved: boolean, liftedBy: Object }} `liftedBy` gives, by
 *   approval id, the comment that lifted it, or `blocking: true` when an
 *   open blocking comment holds it back
 */
function approvalOf(comments) {
  const roots = comments.filter(isRoot).sort((a, b) => timeOf(a) - timeOf(b));
  const openBlocking = roots.some(
    (c) => !isApproval(c) && !c.resolved && c.severity === 'blocking'
  );
  const last = roots[roots.length - 1];
  const approved = Boolean(last && isApproval(last)) && !openBlocking;
  const liftedBy = {};
  // Only the latest approval says why it no longer holds: an earlier one was
  // followed by another approval.
  const lastApprovalIndex = roots.map(isApproval).lastIndexOf(true);
  if (lastApprovalIndex !== -1) {
    const approval = roots[lastApprovalIndex];
    const after = roots[lastApprovalIndex + 1];
    if (after) liftedBy[approval._id] = { by: authorOf(after) };
    else if (openBlocking) liftedBy[approval._id] = { blocking: true };
  }
  return { approved, liftedBy };
}

/**
 * A comment's text as pieces: plain text, and mentions shown as « @Name ».
 * Rendered as text by Vue, never as markup.
 *
 * @param {string} text
 * @returns {Array<{ text: string, mention?: boolean }>}
 */
function segmentsOf(text) {
  if (!text) return [];
  const pieces = [];
  let from = 0;
  text.replace(MENTION, (match, name, offset) => {
    if (offset > from) pieces.push({ text: text.slice(from, offset) });
    pieces.push({ text: `@${name}`, mention: true });
    from = offset + match.length;
    return match;
  });
  if (from < text.length) pieces.push({ text: text.slice(from) });
  return pieces;
}

module.exports = { threadOf, approvalOf, segmentsOf, authorOf, isApproval };

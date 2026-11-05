'use strict';

const { normalizeComment } = require('./comments-api.js');

/**
 * The comments' state (ADR 0020), out of any component: Knockout observables
 * without DOM, which the comments panel renders and the canvas pieces read
 * (the markers rail, the block tool, the quality control's "Add a comment",
 * the counter of the panel button).
 *
 * - The counters load at start, panel closed; the list loads at each opening.
 * - While the panel is open and the tab visible, the list refreshes every 30
 *   seconds, one request at a time. A comment that changed takes its new
 *   version at its place; the others stay as they are, so a view draws again
 *   only what changed. New comments wait behind a pill until the user shows
 *   them. A refresh sent before one of the user's own changes is dropped.
 * - The filter of the list only reads. The target of a new comment follows
 *   the canvas selection; the user may change it until the next selection.
 */

const REFRESH_MS = 30 * 1000;
const APPROVED = 'approved';
const SEVERITY_RANK = { info: 0, important: 1, blocking: 2 };

const isRoot = (c) => !c._parentComment;
// Never a reply nor an approval, as the server counts them.
const isUnresolved = (c) => !c.resolved && isRoot(c) && c.decision !== APPROVED;
const unwrap = (value) => (typeof value === 'function' ? value() : value);
const idOfBlock = (block) => (block ? unwrap(block.id) || null : null);
const sameComment = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The session ended or the access went: refreshing again is pointless.
const isRefusal = (error) => error && [401, 403].includes(error.status);

/**
 * @param {Object} ko - knockout
 * @param {Object} options
 * @param {Object} options.api - list(), counts(), unresolvedCount(): promises
 * @param {Function} options.isOpen - observable, the panel is open
 * @param {Function} options.selection - observable, the selected block
 * @param {Function} [options.isPageHidden] - the browser tab is hidden
 * @param {Object} [options.timers] - every(fn, ms) / stop(id)
 */
function createCommentsStore(
  ko,
  {
    api,
    isOpen,
    selection,
    isPageHidden = () => document.hidden,
    // Not keyed `setInterval`: the build would name the arrow after its key
    // and call the browser's timer on another `this`, which it refuses.
    timers = {
      every: (fn, ms) => setInterval(fn, ms),
      stop: (id) => clearInterval(id),
    },
  }
) {
  const comments = ko.observableArray([]);
  const pending = ko.observableArray([]);
  // false before the first load, 'loading' while it runs, 'error' when it
  // failed, then the number of comments.
  const status = ko.observable(false);
  // The list loaded once: the counters come from it from then on.
  const listLoaded = ko.observable(false);
  const serverCounts = ko.observable({});
  const serverUnresolved = ko.observable(0);
  const filter = ko.observable(null);
  const target = ko.observable(null);
  const draftText = ko.observable('');
  const draftSeverity = ko.observable('info');
  const draftCategory = ko.observable('general');
  let interval = null;
  let inFlight = false;
  // Bumped by every change the user makes, and every load: a refresh sent
  // before one is out of date.
  let changes = 0;
  let disposed = false;

  // Every comment known, those held behind the pill included.
  const allComments = ko.pureComputed(() => comments().concat(pending()));

  const unresolvedCount = ko.pureComputed(() =>
    listLoaded()
      ? allComments().filter(isUnresolved).length
      : serverUnresolved()
  );

  // Per block, from the list once loaded: never the whole email's comments.
  const counts = ko.pureComputed(() => {
    if (!listLoaded()) return serverCounts();
    const byBlock = {};
    allComments()
      .filter((c) => c.blockId && isUnresolved(c))
      .forEach((c) => {
        const entry = byBlock[c.blockId] || { count: 0, maxSeverity: 'info' };
        entry.count += 1;
        if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[entry.maxSeverity]) {
          entry.maxSeverity = c.severity;
        }
        byBlock[c.blockId] = entry;
      });
    return byBlock;
  });

  const hasDraft = ko.pureComputed(() => draftText().trim() !== '');

  function start() {
    api.counts().then(
      (value) => disposed || serverCounts(value || {}),
      () => {}
    );
    api.unresolvedCount().then(
      (value) => disposed || serverUnresolved(value || 0),
      () => {}
    );
  }

  function load() {
    const sent = ++changes;
    // Reopened: the list shown stays while it reloads.
    if (!listLoaded()) status('loading');
    return api.list().then(
      (items) => {
        if (disposed) return undefined;
        // The user changed something meanwhile: this list may miss it.
        if (sent !== changes) return load();
        comments(items || []);
        pending([]);
        listLoaded(true);
        status(comments().length);
        return undefined;
      },
      (error) => {
        if (disposed) return;
        // The list shown stays; without one, the panel offers to retry.
        status(listLoaded() ? comments().length : 'error');
        throw error;
      }
    );
  }

  // The server's list: a changed comment takes its new version at its place,
  // a deleted one goes, a reply to a comment shown joins it, a new comment
  // waits.
  function merge(items) {
    const fresh = new Map(items.map((c) => [c._id, c]));
    const current = comments();
    const next = current
      .filter((c) => fresh.has(c._id))
      .map((c) => (sameComment(c, fresh.get(c._id)) ? c : fresh.get(c._id)));
    const shown = new Set(next.map((c) => c._id));
    const arrived = items.filter((c) => !shown.has(c._id));
    const replies = arrived.filter(
      (c) => !isRoot(c) && shown.has(c._parentComment)
    );
    const held = arrived.filter((c) => replies.indexOf(c) === -1);
    const all = next.concat(replies);
    if (all.length !== current.length || all.some((c, i) => c !== current[i])) {
      comments(all);
    }
    if (!sameComment(held, pending())) pending(held);
  }

  function refresh() {
    if (disposed || inFlight || isPageHidden()) return Promise.resolve();
    const sent = changes;
    inFlight = true;
    return api.list().then(
      (items) => {
        inFlight = false;
        if (!disposed && isOpen() && sent === changes) merge(items || []);
      },
      (error) => {
        inFlight = false;
        if (isRefusal(error)) stopRefreshing();
      }
    );
  }

  function startRefreshing() {
    if (interval) return;
    interval = timers.every(refresh, REFRESH_MS);
  }

  function stopRefreshing() {
    if (!interval) return;
    timers.stop(interval);
    interval = null;
  }

  const openSub = isOpen.subscribe((open) => {
    if (open) {
      load().catch(() => {});
      startRefreshing();
    } else {
      stopRefreshing();
    }
  });

  // A new selection in the canvas is the target, whatever was chosen before.
  const selectionSub = selection.subscribe((block) => target(idOfBlock(block)));

  return {
    comments,
    pending,
    allComments,
    pendingCount: ko.pureComputed(() => pending().length),
    status,
    counts,
    unresolvedCount,
    filter,
    target,
    draftText,
    draftSeverity,
    draftCategory,
    hasDraft,
    start,
    load,
    refresh,
    // The held comments join the list; the filter shows them all.
    showNew() {
      if (!pending().length) return [];
      const shownNow = pending();
      comments(comments().concat(shownNow));
      pending([]);
      filter(null);
      return shownNow;
    },
    // A comment the user posted or changed, as the server answered it.
    upsert(comment) {
      changes++;
      const next = normalizeComment(comment);
      const index = comments().findIndex((c) => c._id === next._id);
      if (index === -1) comments.push(next);
      else comments.splice(index, 1, next);
      pending.remove((c) => c._id === next._id);
      return next;
    },
    // A comment deleted, with its replies.
    remove(commentId) {
      changes++;
      const gone = (c) => c._id === commentId || c._parentComment === commentId;
      comments.remove(gone);
      pending.remove(gone);
    },
    setTarget(blockId) {
      target(blockId || null);
    },
    // Back to the block selected, as after posting a comment.
    followSelection() {
      target(idOfBlock(selection()));
    },
    // "Add a comment" of a quality finding: its block as the target, its text
    // after what the user was writing, its priority and type. Never posted.
    draftFromQuality(draft) {
      target(draft.blockId || null);
      const current = draftText().trim();
      draftText(current ? `${current}\n\n${draft.text}` : draft.text);
      if (draft.severity) draftSeverity(draft.severity);
      if (draft.category) draftCategory(draft.category);
    },
    clearDraft() {
      draftText('');
      draftSeverity('info');
      draftCategory('general');
    },
    dispose() {
      disposed = true;
      stopRefreshing();
      openSub.dispose();
      selectionSub.dispose();
    },
  };
}

module.exports = { createCommentsStore, REFRESH_MS };

'use strict';

/**
 * The comments' state (ADR 0020), out of any component: Knockout observables
 * without DOM, which the comments panel renders and the canvas pieces read
 * (the markers rail, the block tool, the quality control's "Add a comment",
 * the counter of the panel button).
 *
 * - The counters load at start, panel closed; the list loads at each opening.
 * - While the panel is open and the tab visible, the list refreshes every 30
 *   seconds, one request per cycle. A comment already shown is updated in
 *   place, so a reply or an edit under way keeps its object; new comments wait
 *   behind a pill until the user shows them.
 * - The filter of the list only reads. The target of a new comment follows the
 *   canvas selection until the user changes it.
 */

const REFRESH_MS = 30 * 1000;
const APPROVED = 'approved';

const isRoot = (c) => !c._parentComment;
// Never a reply nor an approval, as the server counts them.
const isUnresolved = (c) => !c.resolved && isRoot(c) && c.decision !== APPROVED;
const SEVERITY_RANK = { info: 0, important: 1, blocking: 2 };
const idOfBlock = (block) => (block ? ko_unwrap(block.id) : null);
function ko_unwrap(value) {
  return typeof value === 'function' ? value() : value;
}

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
  // false before the first load, 'loading' while the list loads, then the
  // number of comments.
  const status = ko.observable(false);
  // The list loaded once: the counters come from it from then on.
  const listLoaded = ko.observable(false);
  const serverCounts = ko.observable({});
  const serverUnresolved = ko.observable(0);
  const filter = ko.observable(null);
  const target = ko.observable(null);
  // The user chose the target: it no longer follows the selection.
  let targetChosen = false;
  const draftText = ko.observable('');
  const draftSeverity = ko.observable('info');
  const draftCategory = ko.observable('general');
  // Bumped when a comment shown changed in place: a Knockout view re-renders.
  const revision = ko.observable(0);
  let interval = null;
  let loadedOnce = false;
  let fromUrl = false;
  let disposed = false;

  const loaded = () => listLoaded();

  const unresolvedCount = ko.pureComputed(() =>
    loaded() ? comments().filter(isUnresolved).length : serverUnresolved()
  );

  // Per block, from the list once loaded: never the whole email's comments.
  const counts = ko.pureComputed(() => {
    if (!loaded()) return serverCounts();
    const byBlock = {};
    comments()
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
    api.counts().then((value) => serverCounts(value || {}), () => {});
    api.unresolvedCount().then(
      (value) => serverUnresolved(value || 0),
      () => {}
    );
  }

  function load() {
    status('loading');
    return api.list().then(
      (items) => {
        if (disposed) return;
        comments(items || []);
        pending([]);
        listLoaded(true);
        status(comments().length);
        loadedOnce = true;
      },
      (error) => {
        status(loadedOnce ? comments().length : false);
        throw error;
      }
    );
  }

  // Merge the server's list: update in place, hold the new ones, drop the
  // deleted ones.
  function merge(items) {
    const byId = new Map(items.map((c) => [c._id, c]));
    let changed = false;
    const kept = comments().filter((c) => byId.has(c._id));
    if (kept.length !== comments().length) changed = true;
    kept.forEach((c) => {
      const fresh = byId.get(c._id);
      Object.keys(fresh).forEach((key) => {
        if (JSON.stringify(c[key]) !== JSON.stringify(fresh[key])) {
          c[key] = fresh[key];
          changed = true;
        }
      });
    });
    const shown = new Set(kept.map((c) => c._id));
    const waiting = new Set(pending().map((c) => c._id));
    const fresh = items.filter((c) => !shown.has(c._id));
    // A reply to a comment shown joins its thread at once: it shifts nothing.
    const replies = fresh.filter((c) => !isRoot(c) && shown.has(c._parentComment));
    const held = fresh.filter((c) => replies.indexOf(c) === -1);
    if (changed || replies.length) {
      comments(kept.concat(replies));
      revision(revision() + 1);
    }
    if (held.length !== waiting.size || held.some((c) => !waiting.has(c._id))) {
      pending(held);
    }
  }

  function refresh() {
    if (disposed || isPageHidden()) return Promise.resolve();
    return api.list().then((items) => {
      if (!disposed && isOpen()) merge(items || []);
    }, () => {});
  }

  function showNew() {
    if (!pending().length) return;
    comments(comments().concat(pending()));
    pending([]);
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

  // The target follows the selection until the user chose it.
  const selectionSub = selection.subscribe((block) => {
    if (!targetChosen) target(idOfBlock(block));
  });

  return {
    comments,
    pending,
    pendingCount: ko.pureComputed(() => pending().length),
    status,
    counts,
    unresolvedCount,
    filter,
    target,
    revision,
    draftText,
    draftSeverity,
    draftCategory,
    hasDraft,
    start,
    load,
    refresh,
    showNew,
    // The comments were asked for in the URL (from the list of emails): the
    // opening loads them, once.
    openFromUrl() {
      fromUrl = true;
      return fromUrl && loadedOnce;
    },
    setTarget(blockId) {
      targetChosen = true;
      target(blockId || null);
    },
    // Back to following the selection, as after posting a comment.
    followSelection() {
      targetChosen = false;
      target(idOfBlock(selection()));
    },
    // "Add a comment" of a quality finding: its block as the target, its text
    // after what the user was writing, its priority and type. Never posted.
    draftFromQuality(draft) {
      targetChosen = true;
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

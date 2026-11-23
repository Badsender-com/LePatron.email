'use strict';

/**
 * What the state of a corrections session says (ADR 0011), apart from the
 * component that draws it (ai-corrections-steps.js): which corrections are
 * open, how they group by block, whether the analysis ran or stopped early,
 * and in which words. `t(key, params)` translates.
 */

// Which field a correction is in, on a block or the whole email.
const ROLE_LABELS = {
  title: 'ai-panel-field-title',
  text: 'ai-panel-field-text',
  button: 'ai-panel-field-button',
  alt: 'ai-panel-field-alt',
};

// What a correction that is no longer pending says.
const STATUS_LABELS = {
  accepted: 'ai-panel-correction-accepted',
  undone: 'ai-panel-correction-undone',
  ignored: 'ai-panel-correction-ignored',
  stale: 'ai-panel-correction-stale',
};

// A correction the user can still accept: never answered, or taken back.
const isOpen = (correction) =>
  correction.status === 'pending' || correction.status === 'undone';

// What « Tout accepter » takes: the open corrections, a rewrite excepted. A
// rewrite changes more than a few words: it is accepted on its own.
const isAcceptable = (correction) => isOpen(correction) && !correction.rewrite;
const isOpenRewrite = (correction) =>
  isOpen(correction) && Boolean(correction.rewrite);

// A count said with its own key for one: « 1 correction », « 3 corrections ».
const countKey = (key, count) => (count === 1 ? `${key}-one` : key);
const tCount = (t, key, count) => t(countKey(key, count), { count });

// The session asked, or is asking: shown again, it is not asked twice.
const hasRun = (state) =>
  Boolean(
    state.isLoading ||
      state.done ||
      state.error ||
      state.stopped ||
      state.progress ||
      state.corrections.length
  );

// The analysis of the email stopped with blocks left to analyse.
const stoppedEarly = (state) =>
  Boolean(state.canResume) ||
  Boolean(
    state.stopped &&
      state.progress &&
      state.progress.done < state.progress.total
  );

/**
 * The words of an analysis that ended with no correction, or null while
 * corrections or a stop are to be said instead. « Aucune faute trouvée » only
 * when everything was checked and nothing was set aside.
 * @returns {string|null} a key of the language files
 */
function emptyOutcomeOf(state) {
  if (!state.done || state.isLoading || state.error) return null;
  if (state.corrections.length || stoppedEarly(state)) return null;
  const unchecked = state.tooLong || state.unchecked;
  if (state.nothingToCorrect) {
    return unchecked
      ? 'ai-panel-nothing-checked'
      : 'ai-panel-nothing-to-correct';
  }
  if (state.dropped) return 'ai-panel-no-applicable-correction';
  // Blocks that failed, or a block left when the panel closed on it.
  const partial =
    unchecked ||
    (state.failedBlocks && state.failedBlocks.length) ||
    (state.stopped && !state.progress);
  if (partial) return 'ai-panel-no-correction-in-checked';
  return 'ai-panel-no-correction';
}

// « Analyse arrêtée après 3 blocs sur 12 », never once every block is done.
function stoppedLabelOf(state, t) {
  if (!stoppedEarly(state) || !state.progress) return null;
  const { done, total } = state.progress;
  return t(countKey('ai-panel-correction-stopped', done), { done, total });
}

// What the end of the analysis says to screen readers.
function endMessageOf(state, t) {
  const { corrections, unchecked } = state;
  const stopped = stoppedLabelOf(state, t);
  const empty = emptyOutcomeOf(state);
  const said = [];
  if (stopped) said.push(stopped);
  else if (corrections.length) {
    const key =
      state.target.kind === 'email'
        ? 'ai-panel-correction-finished'
        : 'ai-panel-corrections-count';
    said.push(tCount(t, key, corrections.length));
  } else if (empty) said.push(t(empty));
  if (unchecked) said.push(tCount(t, 'ai-panel-unchecked', unchecked));
  return said.join(' ');
}

/**
 * The corrections of the whole email by block, in the order they came: each
 * group with the id of its heading, and what « Tout accepter dans ce bloc »
 * takes.
 * @param {Array} corrections
 * @param {Function} labelOf (blockId) => the block as the user knows it
 */
function groupsByBlock(corrections, labelOf) {
  const groups = [];
  corrections.forEach((correction) => {
    let group = groups.find((g) => g.blockId === correction.blockId);
    if (!group) {
      group = {
        blockId: correction.blockId,
        id: `ai-panel-group-${correction.blockId}`,
        label: labelOf(correction.blockId),
        corrections: [],
      };
      groups.push(group);
    }
    group.corrections.push(correction);
  });
  return groups.map((group) => ({
    ...group,
    acceptable: group.corrections.filter(isAcceptable).length,
    rewrites: group.corrections.filter(isOpenRewrite).length,
  }));
}

module.exports = {
  ROLE_LABELS,
  STATUS_LABELS,
  isOpen,
  isAcceptable,
  isOpenRewrite,
  countKey,
  hasRun,
  stoppedEarly,
  emptyOutcomeOf,
  stoppedLabelOf,
  endMessageOf,
  groupsByBlock,
};

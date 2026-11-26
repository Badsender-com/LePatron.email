'use strict';

/**
 * Write the values the editor publishes (utils/governance-values.js) where a
 * template reads them: `_root_.audience` compiles to the `audience` property at
 * the root of the email's content, an observable.
 *
 * A template that does not declare the property is not built to react to it,
 * which is why an existing template is unaffected: nothing is added to its
 * content. Covered by tests/editor/publish-to-template.test.js.
 *
 * @param {Object|null} content the root of the email's content
 * @param {Object} values template property → value
 * @returns {{applied: string[], skipped: string[]}}
 */
function publishToTemplate(content, values) {
  const applied = [];
  const skipped = [];
  if (!content) return { applied, skipped };

  Object.keys(values || {}).forEach((name) => {
    const target = content[name];
    if (!isPublishable(target)) {
      skipped.push(name);
      return;
    }
    const next = values[name] == null ? '' : String(values[name]);
    // Written only on a change: an unchanged value is no write at all.
    if (target() !== next) {
      target(next);
      applied.push(name);
    }
  });

  return { applied, skipped };
}

/**
 * Publish to the email's content outside the undo history. The values follow
 * the email settings, which the history does not hold: an undo that took them
 * back would leave the content disagreeing with the settings on screen, and
 * the export with the metadata saved. Republishing after each undo instead
 * would still let the undo rewrite the content first, and needs the history
 * paused anyway for its own write; kept out, they are simply never undone.
 *
 * @param {Object} vm the editor's viewModel, `content` and the undo stack's
 *   `suspendUndo` / `resumeUndo` (undomanager/undomain.js), absent
 *   before the stack starts, when nothing is recorded anyway
 * @param {Object} values template property → value
 * @returns {{applied: string[], skipped: string[]}}
 */
function publishOutsideUndo(vm, values) {
  const pausable = typeof vm.suspendUndo === 'function';
  if (pausable) vm.suspendUndo();
  try {
    return publishToTemplate(vm.content && vm.content(), values);
  } finally {
    if (pausable) vm.resumeUndo();
  }
}

/**
 * Whether a root property of the content is one a published value may replace:
 * an observable holding a plain value (a text, a number, a boolean, or nothing
 * yet), what a template option holds. Never one holding an object or a list,
 * an observable array among them: those are the editor's own structure (the
 * theme's styles, the list of blocks), which a text would destroy.
 *
 * @param {*} target a root property of the content
 * @returns {boolean}
 */
function isPublishable(target) {
  if (typeof target !== 'function') return false;
  const current = target();
  if (current === null || current === undefined) return true;
  return ['string', 'number', 'boolean'].includes(typeof current);
}

module.exports = { publishToTemplate, publishOutsideUndo, isPublishable };

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
    if (typeof target !== 'function') {
      skipped.push(name);
      return;
    }
    const next = values[name] == null ? '' : String(values[name]);
    // Written only on a change: each write is a step in the undo history.
    if (target() !== next) {
      target(next);
      applied.push(name);
    }
  });

  return { applied, skipped };
}

/**
 * A publisher for one editing session, which remembers what each property held
 * before it first wrote it. A design token no longer carried (a brand B with no
 * `textColorVar` after a brand A with one) gets that value back, the template's
 * own, rather than keeping the previous brand's.
 *
 * @returns {{publish: Function}} `publish(content, values)`, as publishToTemplate
 */
function createTemplatePublisher() {
  const originals = new Map();

  function publish(content, values) {
    if (!content) return { applied: [], skipped: [] };
    const restored = {};
    Object.keys(values || {}).forEach((name) => {
      const target = content[name];
      if (typeof target === 'function' && !originals.has(name)) {
        originals.set(name, target());
      }
    });
    originals.forEach((original, name) => {
      if (values && name in values) return;
      restored[name] = original;
      originals.delete(name);
    });
    return publishToTemplate(content, { ...restored, ...values });
  }

  return { publish };
}

module.exports = { publishToTemplate, createTemplatePublisher };

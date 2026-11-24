'use strict';

// The template engine of the block builder.
//
// A template is written as ordinary email HTML with typed placeholders:
//
//   <td style="color:[[color|COLOR|#000000]]">[[label|TEXT]]</td>
//
// `compileTemplate` turns that into `{ chunks, slots }` once, and
// `renderTemplate` joins chunks and escaped values on every render. The split
// matters: compiling parses, renders do not. A render is a loop and a join, so
// it stays sub-millisecond even when it runs on every keystroke.
//
// Why placeholders rather than string interpolation in JS: the context travels
// with the slot, in the template, next to the markup it lands in. A developer
// adding a slot cannot forget to say what it is — the compiler refuses an
// unknown context — which is the mistake that put an XSS in the March POC.
//
// Where the HTML comes from is deliberately out of scope here: written by hand
// today, produced by Maizzle and compiled at build time if the team prefers.
// This module only cares about the placeholders, which keeps that choice open.

const { escapeForContext, CONTEXTS, MARKUP } = require('./slot-contexts.js');

// `[[name|CONTEXT|fallback]]`. Double brackets rather than `{{ }}` or `%% %%`:
// those are ESP personalisation tags, which templates legitimately contain and
// which must pass through untouched.
const PLACEHOLDER = /\[\[([^\]]*)\]\]/g;

const KNOWN_CONTEXTS = new Set(CONTEXTS);

/**
 * @param {string} descriptor the inside of a placeholder
 * @param {boolean} layout whether the template is a layout's
 * @returns {{name: string, context: string, fallback: string}}
 * @throws {Error} on a malformed or unknown declaration — a template bug, which
 *   must fail loudly at build time rather than silently at render time
 */
function parseDescriptor(descriptor, layout) {
  const [name, context, fallback = ''] = descriptor.split('|');

  if (!name || !name.trim()) {
    throw new Error(
      `block-builder: placeholder with no name: [[${descriptor}]]`
    );
  }
  if (!KNOWN_CONTEXTS.has(context)) {
    throw new Error(
      `block-builder: unknown context "${context}" for slot "${name}". ` +
        `Expected one of ${[...KNOWN_CONTEXTS].join(', ')}.`
    );
  }
  // The compiler already refuses MARKUP outside a layout's manifest, but that
  // only covers what goes through the compiler. This covers what reaches the
  // engine at all: a template has to be DEFINED as a layout to hold markup
  // that is not escaped.
  if (context === MARKUP && !layout) {
    throw new Error(
      `block-builder: slot "${name}" is MARKUP, which only a layout may ` +
        'hold — its value is written unescaped. Define the template with ' +
        '`defineLayout` only if the generator, never a user, fills this slot.'
    );
  }

  return { name: name.trim(), context, fallback };
}

/**
 * @param {string} source email HTML with `[[name|CONTEXT|fallback]]` placeholders
 * @param {Object} [options]
 * @param {boolean} [options.layout] lets the template hold MARKUP slots
 * @returns {{chunks: Array<string>, slots: Array<Object>}}
 */
function compileTemplate(source, { layout = false } = {}) {
  if (typeof source !== 'string') {
    throw new Error('block-builder: a template must be a string');
  }

  const chunks = [];
  const slots = [];
  let lastIndex = 0;

  // `PLACEHOLDER` is a global regex and therefore stateful; resetting makes
  // compileTemplate safe to call twice on the same module instance.
  PLACEHOLDER.lastIndex = 0;

  let match = PLACEHOLDER.exec(source);
  while (match !== null) {
    chunks.push(source.slice(lastIndex, match.index));
    slots.push(parseDescriptor(match[1], layout));
    lastIndex = match.index + match[0].length;
    match = PLACEHOLDER.exec(source);
  }

  chunks.push(source.slice(lastIndex));

  // The invariant every render relies on.
  return { chunks, slots };
}

/**
 * @param {{chunks: Array<string>, slots: Array<Object>}} template
 * @param {Object} [values] slot name -> raw value
 * @returns {string}
 */
function renderTemplate(template, values) {
  if (!template || !Array.isArray(template.chunks)) {
    throw new Error('block-builder: renderTemplate needs a compiled template');
  }

  const { chunks, slots } = template;
  const source = values || {};
  let out = chunks[0];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    out +=
      escapeForContext(source[slot.name], slot.context, slot.fallback) +
      chunks[i + 1];
  }

  return out;
}

function define(source, options) {
  const compiled = compileTemplate(source, options);
  const render = (values) => renderTemplate(compiled, values);
  // Kept reachable for tests and for the gallery, which lists what a template
  // expects without rendering it.
  render.slots = compiled.slots;
  return render;
}

/**
 * Compiles once and returns a render function. This is what element modules
 * export, so a template is parsed when the bundle loads and never again.
 *
 * Refuses a MARKUP slot: an element's values come from stored state.
 *
 * @param {string} source
 * @returns {function(Object): string}
 */
function defineTemplate(source) {
  return define(source, { layout: false });
}

/**
 * The same, for a layout: the one kind of template that may hold MARKUP,
 * because the generator fills that slot with markup it built itself.
 *
 * Its own name rather than an option, so the exception reads in the code that
 * takes it — and so a search for `defineLayout` lists every template that
 * writes a value unescaped.
 *
 * @param {string} source
 * @returns {function(Object): string}
 */
function defineLayout(source) {
  return define(source, { layout: true });
}

module.exports = {
  compileTemplate,
  renderTemplate,
  defineTemplate,
  defineLayout,
};

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

const {
  escapeForContext,
  TEXT,
  ATTR,
  URL,
  COLOR,
  PX,
  CSS_VALUE,
} = require('./slot-contexts.js');

// `[[name|CONTEXT|fallback]]`. Double brackets rather than `{{ }}` or `%% %%`:
// those are ESP personalisation tags, which templates legitimately contain and
// which must pass through untouched.
const PLACEHOLDER = /\[\[([^\]]*)\]\]/g;

const KNOWN_CONTEXTS = new Set([TEXT, ATTR, URL, COLOR, PX, CSS_VALUE]);

/**
 * @param {string} descriptor the inside of a placeholder
 * @returns {{name: string, context: string, fallback: string}}
 * @throws {Error} on a malformed or unknown declaration — a template bug, which
 *   must fail loudly at build time rather than silently at render time
 */
function parseDescriptor(descriptor) {
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

  return { name: name.trim(), context, fallback };
}

/**
 * @param {string} source email HTML with `[[name|CONTEXT|fallback]]` placeholders
 * @returns {{chunks: Array<string>, slots: Array<Object>}}
 */
function compileTemplate(source) {
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
    slots.push(parseDescriptor(match[1]));
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

/**
 * Compiles once and returns a render function. This is what element modules
 * export, so a template is parsed when the bundle loads and never again.
 *
 * @param {string} source
 * @returns {function(Object): string}
 */
function defineTemplate(source) {
  const compiled = compileTemplate(source);
  const render = (values) => renderTemplate(compiled, values);
  // Kept reachable for tests and for the gallery, which lists what a template
  // expects without rendering it.
  render.slots = compiled.slots;
  return render;
}

module.exports = {
  compileTemplate,
  renderTemplate,
  defineTemplate,
};

'use strict';

// The subset of Vue the compiler accepts.
//
// The compiler renders the `<template>` and reads `defineProps` — nothing else
// of the SFC ever runs. Anything more an author writes would be silently
// ignored: a `computed` renders as `undefined`, a `<style>` block never reaches
// the email, a second root ships Vue's fragment markers. Each of those is
// refused here with the reason, rather than compiled into something that only
// looks right.

// AST node types and tag types, as @vue/compiler-core numbers them.
const ELEMENT = 1;
const TEXT = 2;
const COMMENT = 3;
const DIRECTIVE = 7;
const TEMPLATE_TAG = 3;

/**
 * Only `<template>` and `<script setup>`, both present.
 *
 * @param {string} name
 * @param {Object} descriptor what compiler-sfc's `parse` returns
 */
function checkBlocks(name, descriptor) {
  if (!descriptor.template) {
    throw new Error(`${name}.vue has no <template>.`);
  }
  if (!descriptor.scriptSetup) {
    throw new Error(
      `${name}.vue has no <script setup>. Its defineProps is what the ` +
        `compiler checks ${name}.slots.js against.`
    );
  }
  if (descriptor.script) {
    throw new Error(
      `${name}.vue has a plain <script> block. Nothing in it would run: ` +
        'only <script setup> is read, and only for its defineProps.'
    );
  }
  if (descriptor.styles.length) {
    throw new Error(
      `${name}.vue has a <style> block, which would never reach the email. ` +
        'Use Tailwind classes, which are inlined, or a style attribute.'
    );
  }
  if (descriptor.customBlocks.length) {
    throw new Error(
      `${name}.vue has a <${descriptor.customBlocks[0].type}> block, which ` +
        'the compiler would ignore.'
    );
  }
}

const callsDefineProps = (node) =>
  Boolean(node) &&
  node.type === 'CallExpression' &&
  node.callee.type === 'Identifier' &&
  node.callee.name === 'defineProps';

// `defineProps(…)`, or `const props = defineProps(…)` — harmless on its own.
const isDefineProps = (statement) =>
  (statement.type === 'ExpressionStatement' &&
    callsDefineProps(statement.expression)) ||
  (statement.type === 'VariableDeclaration' &&
    statement.declarations.length === 1 &&
    callsDefineProps(statement.declarations[0].init));

/**
 * `<script setup>` holds one statement: the `defineProps(…)`.
 *
 * The script never runs — the template is rendered against sentinels, not
 * against whatever the script would compute — so a `computed`, an import or a
 * `withDefaults` would reach the email as `undefined`. Defaults belong to the
 * manifest, which is what the generator reads.
 *
 * @param {string} name
 * @param {Array<Object>} statements compileScript's `scriptSetupAst`
 */
function checkScriptSetup(name, statements) {
  const props = statements.filter(isDefineProps);
  const others = statements.filter((statement) => !isDefineProps(statement));

  if (others.length) {
    throw new Error(
      `${name}.vue: <script setup> may only call defineProps(…), and found ` +
        `a ${others[0].type}. The script never runs at build time, so ` +
        'anything else it computes would render as undefined.'
    );
  }
  if (props.length !== 1) {
    throw new Error(`${name}.vue: <script setup> must call defineProps once.`);
  }
}

const directive = (node, directiveName) =>
  (node.props || []).some(
    (prop) => prop.type === DIRECTIVE && prop.name === directiveName
  );

const continuesChain = (node) =>
  directive(node, 'else') || directive(node, 'else-if');

/**
 * One root element — a `v-if`/`v-else` chain counting as one.
 *
 * Several roots make Vue render a fragment, and its `<!--[-->` markers would
 * ship in every email. Comments do not count: they are stripped.
 *
 * @param {string} name
 * @param {Object} ast `descriptor.template.ast`
 */
function checkSingleRoot(name, ast) {
  const roots = ast.children.filter(
    (node) =>
      node.type !== COMMENT && !(node.type === TEXT && !node.content.trim())
  );
  const heads = roots.filter(
    (node) => !(node.type === ELEMENT && continuesChain(node))
  );

  if (heads.length !== 1 || heads[0].type !== ELEMENT) {
    throw new Error(
      `${name}.vue: the template must have exactly one root element, and ` +
        `has ${heads.length}. Several roots render as a fragment.`
    );
  }
  if (heads[0].tagType === TEMPLATE_TAG || directive(heads[0], 'for')) {
    throw new Error(
      `${name}.vue: the root may not be a <template> or carry a v-for — ` +
        'either renders a fragment.'
    );
  }
}

// What Vue writes when a value it rendered was missing. In an email it is a
// visible word, or a style declaration every client discards.
const MISSING_VALUE = /\b(undefined|null|NaN)\b/;

/**
 * What the render must not contain, checked before comments are stripped —
 * stripping would hide the fragment markers.
 *
 * @param {string} name e.g. `button (default)`
 * @param {string} html
 * @returns {string} the html, without the wrapper root comments cause
 */
function checkRendered(name, html) {
  // Comments beside the root element make Vue wrap the whole render in one
  // fragment. The root itself was checked, so that outer pair is harmless.
  const unwrapped =
    html.startsWith('<!--[-->') && html.endsWith('<!--]-->')
      ? html.slice('<!--[-->'.length, -'<!--]-->'.length)
      : html;

  if (/<!--\[-->|<!--\]-->/.test(unwrapped)) {
    throw new Error(
      `${name}: the template renders a fragment — a v-for, or a <template> ` +
        'with several children. The generator joins strings and never ' +
        'loops, so a repeated shape is written out, not iterated.'
    );
  }

  const missing = MISSING_VALUE.exec(unwrapped);
  if (missing) {
    throw new Error(
      `${name}: the render contains "${missing[0]}". A value the template ` +
        'uses was missing or computed — only props, rendered as they are, ' +
        'reach the email.'
    );
  }

  return unwrapped;
}

module.exports = {
  checkBlocks,
  checkScriptSetup,
  checkSingleRoot,
  checkRendered,
};

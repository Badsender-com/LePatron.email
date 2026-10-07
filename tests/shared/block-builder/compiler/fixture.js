'use strict';

// Builds a throwaway component in memory, so each refusal of the compiler can
// be tested against the smallest SFC that triggers it — no fixture files to
// keep in sync with the real components.

const {
  compileSource,
} = require('../../../../scripts/block-builder/compile-component.js');

/**
 * @param {Object} options
 * @param {string} options.template the inside of `<template>`
 * @param {Object} options.slots the manifest's slots
 * @param {Object} [options.variants]
 * @param {string} [options.script] the inside of `<script setup>`; by default
 *   a defineProps of every slot and variant prop, as String or Boolean
 * @param {string} [options.extra] anything to append to the SFC
 * @param {string} [options.kind] `layout` to compile it as a layout
 * @returns {string}
 */
function sfc({ template, slots, variants, script, extra = '' }) {
  const fixed = Object.values(variants || {}).flatMap(Object.keys);
  const props = Object.keys(slots)
    .map((name) => `  ${name}: String,`)
    .concat([...new Set(fixed)].map((name) => `  ${name}: Boolean,`));
  const setup =
    script === undefined ? `defineProps({\n${props.join('\n')}\n});` : script;
  const scriptBlock =
    setup === null ? '' : `<script setup>\n${setup}\n</script>\n\n`;

  return `${scriptBlock}<template>\n${template}\n</template>\n${extra}`;
}

// Every slot needs a default of its context's type; a fixture that is not
// testing defaults should not have to spell one out.
const withDefaults = (slots) =>
  Object.keys(slots).reduce((all, name) => {
    const slot = slots[name];
    const fill = slot.context === 'PX' ? 0 : '';
    all[name] = 'default' in slot ? slot : { ...slot, default: fill };
    return all;
  }, {});

/**
 * @param {Object} options see `sfc`
 * @returns {Promise<Object<string, string>>} variant -> compiled template
 */
function compileFixture(options) {
  return compileSource({
    name: 'fixture',
    source: sfc(options),
    manifest: {
      slots: withDefaults(options.slots),
      variants: options.variants,
      // Only a layout may declare the one context that does not escape, so a
      // fixture testing that has to be able to claim it — and to fail to.
      ...(options.kind ? { kind: options.kind } : {}),
    },
  });
}

module.exports = { sfc, compileFixture };

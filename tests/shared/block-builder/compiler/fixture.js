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

/**
 * @param {Object} options see `sfc`
 * @returns {Promise<Object<string, string>>} variant -> compiled template
 */
function compileFixture(options) {
  return compileSource({
    name: 'fixture',
    source: sfc(options),
    manifest: { slots: options.slots, variants: options.variants },
  });
}

module.exports = { sfc, compileFixture };

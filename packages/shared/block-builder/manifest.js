'use strict';

// Reads a component manifest (components/*.slots.js) the way both of its
// consumers need it: the compiler, which writes each slot's fallback into the
// compiled template, and the element modules, which hand the generator and the
// editor an element's defaults.
//
// The manifest is the one place an element's initial values are written. They
// used to be written twice — a string fallback in the manifest, a typed default
// in the element module — and the two had already drifted apart.

/**
 * What the generator substitutes when a value is refused at render time.
 *
 * The slot's default, unless the manifest gives a `fallback` of its own — which
 * it does where the default would be wrong in the markup: an empty `href` is a
 * link to the page itself, `#` is a link to nowhere.
 *
 * @param {{default: (string|number), fallback: (string|undefined)}} slot
 * @returns {string}
 */
function fallbackOf(slot) {
  if (slot.fallback !== undefined) return String(slot.fallback);
  return slot.default === undefined ? '' : String(slot.default);
}

/**
 * An element's initial values, typed as the generator and the editor expect:
 * a number for a PX slot, a string otherwise.
 *
 * @param {{slots: Object}} manifest
 * @returns {Object} slot name -> default
 */
function defaultsOf(manifest) {
  return Object.keys(manifest.slots).reduce((defaults, name) => {
    defaults[name] = manifest.slots[name].default;
    return defaults;
  }, {});
}

module.exports = { fallbackOf, defaultsOf };

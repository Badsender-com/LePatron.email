'use strict';

// The five content elements a composition places in its columns.
//
// Each module exports `{ type, render, defaults, translatable }`, and may add
// `fitWidth(values, px)` when its markup writes a width in px that has to fit
// the column it sits in (see image.js). Adding a sixth means adding a file and
// a line here — nothing else in the generator knows the list.
//
// The markup is not written in these modules. It is compiled from
// components/*.vue by `yarn block-builder:compile`, so the people who own the
// email HTML can write it as a Vue component with Tailwind classes — the
// dialect they already use on client templates — instead of a string of
// placeholders. See components/README.md.
//
// What arrives here is the same thing it always was: email HTML with typed
// `[[name|CONTEXT|fallback]]` holes. The engine, the escaping and the runtime
// are untouched; only the authoring moved. And each element's defaults come
// from the same place as its slots: components/<type>.slots.js.

const { MARKUP } = require('../slot-contexts.js');

const text = require('./text.js');
const image = require('./image.js');
const button = require('./button.js');
const divider = require('./divider.js');
const spacer = require('./spacer.js');

/**
 * Refuses an element that holds a MARKUP slot.
 *
 * `defineTemplate` already refuses one, so this catches an element whose
 * render was built with `defineLayout` — the one way left to hand stored
 * state, which is what fills an element, to the output unescaped.
 *
 * Reads every template the element renders: image has two.
 *
 * @param {Object} element `{ type, render }`
 * @returns {Object} the element, unchanged
 * @throws {Error} naming the element and the slot
 */
function checkElement(element) {
  const { render } = element;
  const renders = [render, ...Object.values(render.variants || {})];
  const markup = renders
    .flatMap((each) => each.slots || [])
    .find((slot) => slot.context === MARKUP);
  if (markup) {
    throw new Error(
      `block-builder: element "${element.type}" has slot "${markup.name}" ` +
        'in MARKUP. An element is filled from stored state, so that slot ' +
        'would ship what a user typed unescaped. Only a layout, filled by ' +
        'the generator, may hold MARKUP.'
    );
  }
  return element;
}

const ELEMENTS = [text, image, button, divider, spacer].map(checkElement);

const BY_TYPE = ELEMENTS.reduce((index, element) => {
  index[element.type] = element;
  return index;
}, {});

/**
 * @param {string} type
 * @returns {Object|null} the element definition, or null for an unknown type
 */
function elementFor(type) {
  return Object.prototype.hasOwnProperty.call(BY_TYPE, type)
    ? BY_TYPE[type]
    : null;
}

module.exports = { ELEMENTS, elementFor, checkElement };

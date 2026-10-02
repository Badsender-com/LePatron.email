'use strict';

// The five content elements of the mono-column MVP.
//
// Each module exports `{ type, render, defaults }`. Adding a sixth means adding
// a file and a line here — nothing else in the generator knows the list.
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

const text = require('./text.js');
const image = require('./image.js');
const button = require('./button.js');
const divider = require('./divider.js');
const spacer = require('./spacer.js');

const ELEMENTS = [text, image, button, divider, spacer];

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

module.exports = { ELEMENTS, elementFor };

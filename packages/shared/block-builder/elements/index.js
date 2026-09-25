'use strict';

// The five content elements of the mono-column MVP.
//
// Each module exports `{ type, render, defaults }`. Adding a sixth means adding
// a file and a line here — nothing else in the generator knows the list.

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

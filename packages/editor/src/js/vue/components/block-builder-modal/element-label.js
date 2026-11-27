'use strict';

const {
  isBlankElement,
} = require('../../../../../../shared/block-builder/element-markup.js');

// What the element list calls an element (element-list.js labelFor), and the
// row list after it: its type, then what tells it apart — its first words,
// its label — or that it is blank, and will not be sent (isBlankElement).
// Plain functions: none of this reads the component.

// A text element's words as a reader sees them: tags dropped and character
// references decoded — TinyMCE writes `&nbsp;`, which showed as such in the
// list. Parsed in an inert document, which runs and loads nothing.
function plainTextOf(html) {
  const text =
    typeof DOMParser === 'undefined'
      ? html.replace(/<[^>]*>/g, '')
      : new DOMParser().parseFromString(html, 'text/html').body.textContent;
  return (text || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {Object} element
 * @param {string} name the element's type, as the palette names it
 * @param {string} blank the word for a blank element
 * @returns {string}
 */
function elementLabel(element, name, blank) {
  if (isBlankElement(element)) return `${name} — ${blank}`;
  if (element.type === 'text' && element.content) {
    // The first words, so a list of five texts is still readable.
    const plain = plainTextOf(element.content);
    if (plain) return `${name} — ${plain.slice(0, 28)}`;
  }
  if (element.type === 'button' && element.label) {
    return `${name} — ${element.label.slice(0, 28)}`;
  }
  return name;
}

module.exports = { elementLabel };

'use strict';

/**
 * A template's element tree, built by the HTML5 parser but holding only what
 * translation protection reads: elements, their nesting and three attributes.
 *
 * cheerio kept the whole document: every text node, comment and `style`
 * value, about 26 times the markup in heap (87 MB for a 3.3 MB template). A
 * template with variants per country, on a 644 MB heap, came close to the
 * limit, where the garbage collector stalls the event loop.
 *
 * Built by parse5 rather than read as a stream on purpose: the HTML5 tree
 * construction moves elements a stream would leave in place (content fostered
 * out of a table, a <p> closed by a <div>), and the editor builds its blocks
 * from the browser's tree, which follows the same rules. A field attached to
 * the wrong block would be translated although protected.
 */

const parse5 = require('parse5');
const defaultTreeAdapter = require('parse5/lib/tree-adapters/default.js');

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const PROTECTION_ATTRIBUTES = new Set([
  'data-ko-block',
  'data-ko-editable',
  'data-translate',
]);
// The parser reads attributes back from the tree in three places only:
// comparing these formatting elements (the "Noah's Ark" clause), deciding
// SVG and MathML integration points, and merging repeated <html> and <body>
// tags. Those elements keep all their attributes, so the tree is built
// exactly as before; every other element keeps only the three above.
const FORMATTING_ELEMENTS = new Set([
  'a',
  'b',
  'big',
  'code',
  'em',
  'font',
  'i',
  'nobr',
  's',
  'small',
  'strike',
  'strong',
  'tt',
  'u',
]);

// Text and comments never decide protection: dropped as they are parsed.
const IGNORED_NODE = Object.freeze({ nodeName: '#ignored' });

function keepsAllAttributes(tagName, namespaceURI) {
  return (
    namespaceURI !== HTML_NAMESPACE ||
    FORMATTING_ELEMENTS.has(tagName) ||
    tagName === 'html' ||
    tagName === 'body'
  );
}

const elementTreeAdapter = {
  ...defaultTreeAdapter,

  createElement(tagName, namespaceURI, attrs) {
    return {
      nodeName: tagName,
      tagName,
      namespaceURI,
      attrs: keepsAllAttributes(tagName, namespaceURI)
        ? attrs
        : attrs.filter((attr) => PROTECTION_ATTRIBUTES.has(attr.name)),
      childNodes: [],
      parentNode: null,
    };
  },

  createCommentNode() {
    return IGNORED_NODE;
  },

  appendChild(parentNode, newNode) {
    if (newNode === IGNORED_NODE) return;
    defaultTreeAdapter.appendChild(parentNode, newNode);
  },

  insertBefore(parentNode, newNode, referenceNode) {
    if (newNode === IGNORED_NODE) return;
    defaultTreeAdapter.insertBefore(parentNode, newNode, referenceNode);
  },

  insertText() {},

  insertTextBefore() {},
};

/**
 * @param {string} markup - Template HTML markup
 * @returns {Object} The document node; elements have `attrs` and `childNodes`
 */
function parseElementTree(markup) {
  return parse5.parse(markup, { treeAdapter: elementTreeAdapter });
}

/**
 * @returns {string|undefined} The attribute's value, undefined when absent
 */
function getAttribute(element, name) {
  const attr = (element.attrs || []).find(
    (candidate) => candidate.name === name
  );
  return attr ? attr.value : undefined;
}

module.exports = { parseElementTree, getAttribute };

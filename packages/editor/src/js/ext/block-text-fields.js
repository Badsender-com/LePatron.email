'use strict';

const _ = require('lodash');
const {
  extractBlockTranslatableContent,
  isTranslatableValue,
  isStyleValue,
} = require('../utils/block-content-extractor');
const { shownTextOf } = require('./visible-text');

/**
 * The text fields of a block: one listing for quality control and the AI
 * actions (#1253). A text field is a field block translation names as text —
 * the same names, the same exclusions (colours, links, styles) —, so every
 * feature that reads a block's text reads the same fields.
 *
 * By default the listing holds what translation translates. A field a reader
 * sees but translation leaves alone (a lone merge tag, an address) is listed
 * on demand, with `translatable: false`. A colour or a size is no text and is
 * never listed.
 *
 * Each field comes with its path in the block (dots, list indexes), its value
 * (HTML for rich text), its visible text, its role, whether it is still at the
 * template's default, and whether the rendering hides it. Only the caller
 * knows the rendering: it says so through `isHidden`. The visible text is read
 * through a DOM parser: the listing runs in the editor.
 */

// A button is told by its words (`buttonText`, `ctaLabel`, `mainBtn.text`) or
// by being a link object's text (`buttonLink.text`, versafix's `link.text`,
// `links.0.text`). A label alone names something (`priceLabel`,
// `badgeLabel`): it is text.
const BUTTON_WORDS = new Set(['button', 'btn', 'cta']);
const LINK_TEXT = new Set(['text', 'label']);
const isTitleWord = (word) =>
  /title$/.test(word) || /^head(ing|line)$/.test(word);
// Versafix names a title `text` and gives its block a title style
// (`titleBlock`, `singleArticleBlock`), and names the labels of share
// buttons `fbText`, `twText`… in a block with a `shareButtonStyle`.
const TITLE_STYLES = ['titleTextStyle', 'bigTitleStyle'];
const BUTTON_STYLE = /.ButtonStyle$/;

/** The words of a field name: camelCase, snake_case, kebab-case, acronyms. */
const wordsOf = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);

/**
 * What a reader sees of a value: the text of its markup, entities decoded,
 * hidden markup left out, a space for each block-level break, none for an
 * inline tag, ordinary spaces collapsed. Non-breaking spaces are kept: they
 * are what the value holds.
 * @param {string} value
 * @returns {string}
 */
function visibleText(value) {
  const doc = new DOMParser().parseFromString(String(value || ''), 'text/html');
  return shownTextOf(doc.body)
    .replace(/[^\S\u00a0]+/g, ' ')
    .replace(/^ | $/g, '');
}

// Two values that read the same are the same text, whatever their spaces.
const comparable = (text) => text.replace(/\s+/g, ' ').trim();

const hasKey = (models, test) =>
  models.some((model) => Object.keys(model).some(test));

/** A field the block's own styles name: a title or a share button. */
function roleByStyle(segments, words, models) {
  if (segments.length !== 1) return null;
  if (segments[0] === 'text') {
    return hasKey(models, (key) => TITLE_STYLES.includes(key)) ? 'title' : null;
  }
  const labelOfStyledButton =
    _.last(words) === 'text' &&
    !words.some((word) => word === 'long' || isTitleWord(word)) &&
    hasKey(models, (key) => BUTTON_STYLE.test(key));
  return labelOfStyledButton ? 'button' : null;
}

/**
 * What the field is: an alternative text by the words of its own name, a
 * button or a title by the words of its whole path, since a link object's
 * text (`text`) tells nothing on its own.
 */
function roleOf(path, models) {
  const segments = path.split('.').filter((segment) => !/^\d+$/.test(segment));
  const nameWords = wordsOf(_.last(segments));
  if (nameWords[0] === 'alt' || _.last(nameWords) === 'alt') return 'alt';
  const words = _.flatMap(segments, wordsOf);
  const parent = segments[segments.length - 2];
  const linkText =
    LINK_TEXT.has(_.last(segments)) &&
    !!parent &&
    _.last(wordsOf(parent)).replace(/s$/, '') === 'link';
  if (linkText || words.some((word) => BUTTON_WORDS.has(word))) {
    return 'button';
  }
  if (words.some(isTitleWord)) return 'title';
  return roleByStyle(segments, words, models) || 'text';
}

/** Whether the field still reads as the template's default. */
function isAtDefault(text, blockDef, path) {
  const templateDefault = blockDef && _.get(blockDef, path);
  if (typeof templateDefault !== 'string') return false;
  const expected = comparable(visibleText(templateDefault));
  return !!expected && comparable(text) === expected;
}

// What a reader may see in a text field: anything but blank or a style value.
const isShownValue = (value) =>
  typeof value === 'string' && value.trim() !== '' && !isStyleValue(value);

/**
 * @param {Object} block the block's model, unwrapped
 * @param {Object} [options]
 * @param {Object} [options.blockDef] the template's definition of the block,
 *   whose values are its defaults
 * @param {(path: string, role: string) => boolean} [options.isHidden] whether
 *   the rendering hides the field
 * @param {boolean} [options.untranslatable] also list the named fields
 *   translation leaves alone (a lone merge tag, an address); a string in a
 *   list is listed only if translatable
 * @returns {Array<{ path: string, role: string, value: string, text: string, translatable: boolean, atDefault: boolean, hidden: boolean }>}
 *   `text` keeps non-breaking spaces: a text made of them is not empty as a
 *   string, though it is for a reader (test it for a letter, not for
 *   emptiness).
 */
function listTextFields(
  block,
  { blockDef = null, isHidden = () => false, untranslatable = false } = {}
) {
  const accept = untranslatable ? isShownValue : isTranslatableValue;
  const models = [block, blockDef].filter(Boolean);
  return Object.entries(extractBlockTranslatableContent(block, { accept })).map(
    ([path, value]) => {
      const role = roleOf(path, models);
      const text = visibleText(value);
      return {
        path,
        role,
        value,
        text,
        translatable: isTranslatableValue(value),
        atDefault: isAtDefault(text, blockDef, path),
        hidden: Boolean(isHidden(path, role)),
      };
    }
  );
}

module.exports = { listTextFields, visibleText };

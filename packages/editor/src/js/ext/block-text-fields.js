'use strict';

const _ = require('lodash');
const {
  extractBlockTranslatableContent,
} = require('../utils/block-content-extractor');

/**
 * The text fields of a block: one listing for quality control and the AI
 * actions (#1253). A text field is what block translation translates — the
 * same names, the same exclusions (colours, links, styles) —, so every feature
 * that reads a block's text reads the same fields.
 *
 * Each field comes with its path in the block (dots, list indexes), its value
 * (HTML for rich text), its role, whether it still holds the template's sample
 * text, and whether the rendering hides it. Only the caller knows the
 * rendering: it says so through `isHidden`.
 */

const ALT = /alt$/i;
const BUTTON = /button|cta|label/i;
const TITLE = /title|heading/i;

/** What the field is, from its name: what a reader sees it as. */
function roleOf(path) {
  const name = _.last(path.split('.'));
  if (ALT.test(name)) return 'alt';
  if (BUTTON.test(name)) return 'button';
  if (TITLE.test(name)) return 'title';
  return 'text';
}

/**
 * @param {Object} block the block's model, unwrapped
 * @param {Object} [options]
 * @param {Object} [options.blockDef] the template's definition of the block,
 *   whose values are its sample texts
 * @param {(path: string, role: string) => boolean} [options.isHidden] whether
 *   the rendering hides the field
 * @returns {Array<{ path: string, role: string, value: string, sample: boolean, hidden: boolean }>}
 */
function listTextFields(block, { blockDef = null, isHidden = () => false } = {}) {
  return Object.entries(extractBlockTranslatableContent(block)).map(
    ([path, value]) => {
      const role = roleOf(path);
      return {
        path,
        role,
        value,
        sample: Boolean(blockDef) && value === _.get(blockDef, path),
        hidden: Boolean(isHidden(path, role)),
      };
    }
  );
}

module.exports = { listTextFields };

'use strict';

const _ = require('lodash');
const { getBlockDefault } = require('./ownership');

// What the client formatted by hand in the rich texts of a block: the inline
// styles TinyMCE writes (font size, colour, alignment, line height…) and the
// tags they chose (headings, links). A rich text still equal to the
// template's default is the template's; in an edited one, a declaration the
// default already carried is still the template's. Only the rest is judged.
//
// Block style properties are left out on purpose: templates such as Clarins
// map them to their own design tokens ("h1_times", "primary"), not to CSS.

const TEXT_KEY = /(text|title|label|caption|content|heading|description)$/i;
const HAS_MARKUP = /<[a-z]/i;

function stringLeaves(value, path = []) {
  if (typeof value === 'string') return [{ path, value }];
  if (!value || typeof value !== 'object') return [];
  return _.flatMap(Object.keys(value), (key) =>
    stringLeaves(value[key], path.concat(key))
  );
}

// "prop:value" of every inline declaration under a root element.
function declarationsOf(root) {
  return new Set(
    _.flatMap(Array.from(root.querySelectorAll('[style]')), (el) =>
      el
        .getAttribute('style')
        .split(';')
        .map((decl) => decl.replace(/\s+/g, '').toLowerCase())
        .filter(Boolean)
    )
  );
}

/**
 * The rich texts of a block the client edited, parsed in the inert export
 * document. Each comes with `isUserDeclaration(prop, value)`, true when that
 * declaration is not the template's.
 * @returns {Array<{ blockId: string, path: string, root: Element,
 *   isUserDeclaration: Function }>}
 */
function editedRichTexts(ctx, block) {
  const def = getBlockDefault(ctx.blockDefs, block.type) || {};
  const parse = (html) => {
    const root = ctx.doc.createElement('div');
    root.innerHTML = html || '';
    return root;
  };
  return stringLeaves(block)
    .filter(({ path, value }) => {
      const key = String(_.last(path));
      return TEXT_KEY.test(key) && HAS_MARKUP.test(value);
    })
    .filter(({ path, value }) => value !== _.get(def, path))
    .map(({ path, value }) => {
      const templateDeclarations = declarationsOf(parse(_.get(def, path)));
      return {
        blockId: block.id,
        path: path.join('.'),
        root: parse(value),
        isUserDeclaration: (prop, val) =>
          !templateDeclarations.has(
            `${prop}:${String(val).replace(/\s+/g, '')}`.toLowerCase()
          ),
      };
    });
}

/** The edited rich texts of every block of the client, read once per run. */
function allEditedRichTexts(ctx) {
  if (!ctx.cache.editedRichTexts) {
    ctx.cache.editedRichTexts = _.flatMap(ctx.blocks, (block) =>
      block ? editedRichTexts(ctx, block) : []
    );
  }
  return ctx.cache.editedRichTexts;
}

/**
 * Every inline declaration the client wrote, with its element.
 * @returns {Array<{ blockId, path, element: Element, prop, value }>}
 */
function userDeclarations(ctx) {
  return _.flatMap(allEditedRichTexts(ctx), (richText) =>
    _.flatMap(Array.from(richText.root.querySelectorAll('[style]')), (element) =>
      element
        .getAttribute('style')
        .split(';')
        .map((decl) => decl.split(':'))
        .filter(([prop, ...rest]) => prop && rest.length)
        .map(([prop, ...rest]) => ({
          prop: prop.trim().toLowerCase(),
          value: rest.join(':').trim(),
        }))
        .filter(({ prop, value }) => richText.isUserDeclaration(prop, value))
        .map(({ prop, value }) => ({
          blockId: richText.blockId,
          path: richText.path,
          element,
          prop,
          value,
        }))
    )
  );
}

// A CSS length in px (pt converted), or null (em, %, keywords…).
function toPx(value) {
  const m = /^([\d.]+)\s*(px|pt)?$/i.exec(String(value || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return (m[2] || 'px').toLowerCase() === 'pt' ? n * (4 / 3) : n;
}

const hasText = (el) => /\S/.test(el.textContent || '');

module.exports = {
  allEditedRichTexts,
  userDeclarations,
  toPx,
  hasText,
};

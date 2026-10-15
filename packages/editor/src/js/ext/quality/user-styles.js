'use strict';

const _ = require('lodash');
const { getBlockDefault } = require('./ownership');
const { parseDeclarations } = require('./inline-style');
const { SYNTHETIC_BLOCKS } = require('../html-code-block/block-types');

// What the client formatted by hand in the rich texts of a block: the inline
// styles TinyMCE writes (font size, colour, alignment, line height…) and the
// tags they chose (headings, links). A rich text still equal to the
// template's default is the template's; in an edited one, a declaration the
// default already carried is still the template's. Only the rest is judged.
//
// Block style properties are left out on purpose: some client templates map
// them to their own design tokens ("h1_times", "primary"), not to CSS.

// Client templates name their rich texts freely (`legal`, `body`, `paragraph`):
// a rich text is any string holding markup, except the properties that hold an
// address, a colour or a style token by convention, and the markup of the
// synthetic blocks (pasted code, the builder's output and state), which is
// the client's but no rich text: the HTML code rules read it.
const NOT_A_RICH_TEXT = /^(id|type)$|(src|href|url|link|image|color|style)$/i;
const SYNTHETIC_PROPERTIES = new Set(
  _.flatMap(SYNTHETIC_BLOCKS, (block) =>
    [block.htmlProperty, block.stateProperty].filter(Boolean)
  )
);
const HAS_MARKUP = /<[a-z]/i;

function stringLeaves(value, path = []) {
  if (typeof value === 'string') return [{ path, value }];
  if (!value || typeof value !== 'object') return [];
  return _.flatMap(Object.keys(value), (key) =>
    stringLeaves(value[key], path.concat(key))
  );
}

// TinyMCE reserialises a text it only displayed: attributes it adds for
// itself and whitespace do not make a text the client's.
const normalizeMarkup = (html) =>
  String(html || '')
    .replace(/ data-mce-[a-z-]+="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// "prop:value" of every inline declaration under a root element.
const declarationKey = (prop, value) =>
  `${prop}:${String(value).replace(/\s+/g, '')}`.toLowerCase();

function declarationsUnder(root) {
  return new Set(
    _.flatMap(Array.from(root.querySelectorAll('[style]')), (el) =>
      parseDeclarations(el.getAttribute('style')).map(({ prop, value }) =>
        declarationKey(prop, value)
      )
    )
  );
}

function parseIn(ctx, html) {
  const root = ctx.doc.createElement('div');
  root.innerHTML = html || '';
  return root;
}

// The template's default of one rich text, parsed once per run for every
// block of that type.
function templateRichText(ctx, type, path) {
  const cache =
    ctx.cache.templateRichTexts || (ctx.cache.templateRichTexts = {});
  const key = `${type}|${path.join('.')}`;
  if (!cache[key]) {
    const def = getBlockDefault(ctx.blockDefs, type) || {};
    const root = parseIn(ctx, _.get(def, path));
    cache[key] = {
      markup: normalizeMarkup(root.innerHTML),
      declarations: declarationsUnder(root),
    };
  }
  return cache[key];
}

/**
 * The rich texts of a block the client edited, parsed in the inert export
 * document. Each comes with `isUserDeclaration(prop, value)`, true when that
 * declaration is not the template's.
 * A rich text inside an array (`items[1].text`) has no default at its path
 * when the template declares fewer items: it is then the client's as a whole.
 * @returns {Array<{ blockId: string, path: string, root: Element,
 *   isUserDeclaration: Function }>}
 */
function editedRichTexts(ctx, block) {
  return stringLeaves(block)
    .filter(({ path, value }) => {
      const key = String(_.last(path));
      return (
        !NOT_A_RICH_TEXT.test(key) &&
        !SYNTHETIC_PROPERTIES.has(key) &&
        HAS_MARKUP.test(value)
      );
    })
    .map(({ path, value }) => ({
      path,
      root: parseIn(ctx, value),
      template: templateRichText(ctx, block.type, path),
    }))
    .filter(
      ({ root, template }) =>
        normalizeMarkup(root.innerHTML) !== template.markup
    )
    .map(({ path, root, template }) => ({
      blockId: block.id,
      path: path.join('.'),
      root,
      isUserDeclaration: (prop, val) =>
        !template.declarations.has(declarationKey(prop, val)),
    }));
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
 * Every inline declaration the client wrote, with its element, read once per
 * run: four rules go through them.
 * @returns {Array<{ blockId, path, richText, element: Element, prop, value }>}
 */
function userDeclarations(ctx) {
  if (!ctx.cache.userDeclarations) {
    ctx.cache.userDeclarations = _.flatMap(
      allEditedRichTexts(ctx),
      (richText) =>
        _.flatMap(
          Array.from(richText.root.querySelectorAll('[style]')),
          (element) =>
            parseDeclarations(element.getAttribute('style'))
              .filter(({ prop, value }) =>
                richText.isUserDeclaration(prop, value)
              )
              .map(({ prop, value }) => ({
                blockId: richText.blockId,
                path: richText.path,
                richText,
                element,
                prop,
                value,
              }))
        )
    );
  }
  return ctx.cache.userDeclarations;
}

const hasText = (el) => /\S/.test(el.textContent || '');

module.exports = {
  allEditedRichTexts,
  userDeclarations,
  normalizeMarkup,
  hasText,
};

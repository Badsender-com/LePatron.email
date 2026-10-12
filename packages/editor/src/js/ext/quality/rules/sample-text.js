'use strict';

const _ = require('lodash');
const { getBlockDefault } = require('../ownership');
const { blockTexts } = require('../exported-content');
const { listTextFields } = require('../../block-text-fields');

const LOREM = /\blorem ipsum\b/i;
const MIN_LENGTH = 3;
const EXCERPT_LENGTH = 60;
const normalize = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase();

// The text a rich-text value shows: tags dropped, entities decoded, in the
// inert export document so nothing is fetched.
function plainText(ctx, html) {
  const el = ctx.doc.createElement('div');
  el.innerHTML = html;
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

const excerpt = (text) =>
  text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;

module.exports = {
  id: 'sample-text',
  category: 'copy',
  severity: 'error',
  titleKey: 'Sample texts',
  passKey: 'Every sample text of the template has been replaced',
  run(ctx) {
    const texts = blockTexts(ctx);
    return _.flatMap(ctx.blocks, (block) => {
      const shown = normalize(texts[block && block.id] || '');
      if (!shown) return [];
      if (LOREM.test(shown)) {
        return [
          {
            messageKey: 'Placeholder text (lorem ipsum) left in the block',
            blockId: block.id,
            value: 'lorem',
          },
        ];
      }
      // A text still equal to the template's default, and still shown: the
      // client kept the sample. Only a warning: a default label ("Shop now")
      // may be kept on purpose.
      const def = getBlockDefault(ctx.blockDefs, block.type);
      if (!def) return [];
      // The block's text fields (ext/block-text-fields.js), as translation and
      // the AI actions read them; an alternative text is not shown text. A
      // style value left at its default ("center", "Arial") is never one.
      return listTextFields(block, { blockDef: def })
        .filter((field) => field.sample && field.role !== 'alt')
        .map((field) => ({ ...field, text: plainText(ctx, field.value) }))
        .filter(
          (leaf) =>
            (leaf.text.match(/\p{L}/gu) || []).length >= MIN_LENGTH &&
            shown.includes(normalize(leaf.text))
        )
        .map((leaf) => ({
          messageKey: 'Sample text of the template not replaced: __text__',
          severity: 'warning',
          params: { text: excerpt(leaf.text) },
          blockId: block.id,
          propertyPath: leaf.path,
          value: leaf.value,
        }));
    });
  },
};

'use strict';

const {
  extractBlockTranslatableContent,
} = require('../../utils/block-content-extractor');

/**
 * The email's text as the reader sees it, for text generation (epic #1163).
 *
 * Read from the editor's content model rather than the saved mailing: the user
 * generates from what is on screen, saved or not. Only the blocks count: the
 * preheader, header and footer of the template are its frame, not the message.
 *
 * Which fields hold text is the block translation's decision, reused as is;
 * this adds what the model needs on top: the order, a role, plain text, and
 * nothing the reader does not see.
 */

// Alternatives of images and the like: read by screen readers, not by the eye
// that scans an inbox, and often filled with file names.
const NOT_COPY = /(^|\.)(alt|imageAlt|altText|title)$/;
// `title` alone is an image tooltip; `titleText` is a heading.
const TITLE = /title|heading/i;
const BUTTON = /button|cta|label/i;

const ENTITIES = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
};

function toPlainText(html) {
  return html
    .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (_, name) => ENTITIES[name])
    .replace(/\s+/g, ' ')
    .trim();
}

function roleOf(path) {
  if (BUTTON.test(path)) return 'button';
  if (TITLE.test(path)) return 'title';
  return 'text';
}

/**
 * Templates hide a part of a block with a `<part>Visible` flag next to it
 * (`titleVisible` for `titleText`, `buttonVisible` for `buttonLink.text`). A
 * field is hidden when a flag named after one of its leading words is false.
 */
function isHidden(block, path) {
  const head = path.split('.')[0];
  const words = head.split(/(?=[A-Z])/);
  for (let count = 1; count <= words.length; count += 1) {
    const flag = `${words.slice(0, count).join('')}Visible`;
    if (block[flag] === false) return true;
  }
  return false;
}

/**
 * @param {Object} content the editor content, unwrapped (`ko.toJS(viewModel.content())`)
 * @returns {Array<{ role: 'title'|'text'|'button', text: string }>} in reading order
 */
function extractEmailCopy(content) {
  const blocks =
    (content && content.mainBlocks && content.mainBlocks.blocks) || [];
  const copy = [];
  blocks.forEach((block) => {
    const fields = extractBlockTranslatableContent(block);
    Object.keys(fields).forEach((path) => {
      if (NOT_COPY.test(path) || isHidden(block, path)) return;
      const text = toPlainText(fields[path]);
      if (text) copy.push({ role: roleOf(path), text });
    });
  });
  return copy;
}

module.exports = { extractEmailCopy };

'use strict';

/**
 * The email's text as the reader sees it, for text generation (epic #1163).
 *
 * Read from the editor's rendering, not from its content model. The model holds
 * every field a template declares — the parts a display rule hides, the
 * variants of other brands, ten list items of which two are shown — and only
 * the template knows which of them end up on screen: the editor has already
 * applied those rules when it renders. So the text sent is exactly what the
 * user sees, saved or not.
 *
 * Every editable text is rendered with the id `ko_<block>_<n>_<field>`, under
 * its block's container `ko_<block>_<n>`. Left out:
 * - the header and footer blocks: the frame of the email, not its message;
 * - a field the rendering hides;
 * - a text left at the template's sample value ("Title", "CALL TO ACTION"):
 *   nobody wrote it, and it would mislead the model.
 */

const BLOCK_ID = /^ko_([A-Za-z][A-Za-z0-9]*)_(\d+)$/;
const FRAME_BLOCK = /header|footer|preheader/i;
const TITLE = /title|heading/i;
const BUTTON = /button|cta/i;
const BLOCK_LEVEL = 'p, div, li, h1, h2, h3, h4, h5, h6, td, tr';

/** Plain text of an element, block boundaries and line breaks as spaces. */
function textOf(element) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  clone
    .querySelectorAll(BLOCK_LEVEL)
    .forEach((node) => node.append(' '));
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

/** Same plain text from an HTML string — a template's sample value. */
function textOfHtml(html, document) {
  const holder = document.createElement('div');
  holder.innerHTML = String(html);
  return textOf(holder);
}

function isHidden(element, stopAt) {
  const view = element.ownerDocument.defaultView;
  for (let node = element; node && node !== stopAt; node = node.parentElement) {
    if (node.hidden) return true;
    const style = view.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
  }
  return false;
}

function roleOf(element, field) {
  if (/^H[1-6]$/.test(element.tagName)) return 'title';
  if (element.tagName === 'A' || BUTTON.test(field)) return 'button';
  if (TITLE.test(field)) return 'title';
  return 'text';
}

/**
 * @param {Element|Document} root the editor's canvas
 * @param {Object} [options]
 * @param {(blockType: string, field: string) => (string|undefined)} [options.sampleFor]
 *   the template's sample value of a field, to leave it out when unchanged
 * @returns {Array<{ role: 'title'|'text'|'button', text: string }>} in reading order
 */
function extractEmailCopy(root, { sampleFor = () => undefined } = {}) {
  const document = root.ownerDocument || root;
  const copy = [];
  root.querySelectorAll('[id^="ko_"]').forEach((block) => {
    const match = BLOCK_ID.exec(block.id);
    if (!match) return;
    const blockType = match[1];
    if (FRAME_BLOCK.test(blockType)) return;

    const prefix = `${block.id}_`;
    block.querySelectorAll('[contenteditable]').forEach((field) => {
      if (!field.id || !field.id.startsWith(prefix)) return;
      if (isHidden(field, block)) return;
      const name = field.id.slice(prefix.length);
      const text = textOf(field);
      if (!text) return;
      const sample = sampleFor(blockType, name);
      if (sample !== undefined && textOfHtml(sample, document) === text) return;
      copy.push({ role: roleOf(field, name), text });
    });
  });
  return copy;
}

module.exports = { extractEmailCopy };

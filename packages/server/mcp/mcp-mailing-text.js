'use strict';

const cheerio = require('cheerio');

// What an assistant reads of a mailing (#1304): its words in reading order,
// headings and links kept as Markdown, never a tag nor a style. Read from the
// sanitised preview, the very HTML the app serves.

const SKIPPED = new Set(['head', 'title', 'style', 'script', 'noscript']);
const BLOCKS = new Set([
  'p',
  'div',
  'td',
  'th',
  'tr',
  'table',
  'li',
  'ul',
  'ol',
  'center',
  'blockquote',
  'section',
  'header',
  'footer',
]);
const HEADING = /^h([1-6])$/;
// The padding a preheader carries so that the client shows nothing after it.
const INVISIBLE = new RegExp(
  [0x200b, 0x200c, 0x200d, 0x034f, 0x00ad, 0x2060, 0xfeff]
    .map((code) => String.fromCharCode(code))
    .join('|'),
  'g'
);
const LINKABLE = /^(https?:|mailto:|tel:|\{\{|%%|\[\[)/i;

// One line of words, its spaces collapsed.
const tidy = (text) => text.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
// A block's lines, each tidied, the empty ones dropped.
const tidyLines = (text) => text.split('\n').map(tidy).filter(Boolean);

const styleOf = (node) => (node.attribs && node.attribs.style) || '';
const isHidden = (node) => /display\s*:\s*none/i.test(styleOf(node));
// How a template hides its preheader, beyond `display: none`: a block also
// hidden for the clients that ignore it. A mobile-only block shows itself
// through a media query instead.
const PREHEADER_SIGNS = /max-height\s*:\s*0|opacity\s*:\s*0|font-size\s*:\s*[01]px|line-height\s*:\s*[01]px|visibility\s*:\s*hidden/i;
const isBlock = (node) =>
  node.type === 'tag' && (BLOCKS.has(node.name) || HEADING.test(node.name));
const holdsBlocks = (node) =>
  (node.children || []).some((child) => isBlock(child) || holdsBlocks(child));
const hrefOf = (node) =>
  node.name === 'a' ? ((node.attribs && node.attribs.href) || '').trim() : '';

// The visible words of an element, images by their alternative text.
function textOfNode(node) {
  if (node.type === 'text') return node.data;
  if (node.type !== 'tag' || SKIPPED.has(node.name) || isHidden(node)) {
    return '';
  }
  if (node.name === 'img')
    return ` ${(node.attribs && node.attribs.alt) || ''} `;
  if (node.name === 'br') return ' ';
  const words = (node.children || []).map(textOfNode).join('');
  return isBlock(node) ? ` ${words} ` : words;
}

/**
 * The text of a mailing's HTML, as Markdown blocks: a heading after `#`, a link
 * as `[label](href)`, an image by its alternative text. Hidden elements are
 * left out; the first one, before any visible word and hidden the way a
 * preheader is, is the preheader.
 *
 * @param {string} html
 * @returns {{ preheader: string|null, body: string }}
 */
function textOfHtml(html) {
  const $ = cheerio.load(html);
  const blocks = [];
  let line = '';
  let prefix = '';
  let preheader = null;
  let seenHidden = false;

  const flush = () => {
    const lines = tidyLines(line);
    if (lines.length) {
      // A heading stays one line, whatever breaks it.
      blocks.push(prefix ? `${prefix}${lines.join(' ')}` : lines.join('\n'));
    }
    line = '';
    prefix = '';
  };

  const walk = (node) => {
    if (node.type === 'text') {
      line += node.data;
      return;
    }
    if (node.type !== 'tag' || SKIPPED.has(node.name)) return;
    if (isHidden(node)) {
      const first = !seenHidden && blocks.length === 0 && !tidy(line);
      seenHidden = true;
      if (first && PREHEADER_SIGNS.test(styleOf(node))) {
        preheader = tidy(textOfNode({ ...node, attribs: {} })) || null;
      }
      return;
    }
    if (node.name === 'br') {
      line += '\n';
      return;
    }
    if (node.name === 'img') {
      line += textOfNode(node);
      return;
    }
    const href = hrefOf(node);
    if (href && LINKABLE.test(href)) {
      if (holdsBlocks(node)) {
        // A card wrapped in one link: its blocks as they are, then the link.
        flush();
        (node.children || []).forEach(walk);
        flush();
        blocks.push(`→ ${href}`);
        return;
      }
      const label = tidy(textOfNode(node));
      line += label ? ` [${label}](${href}) ` : ` ${href} `;
      return;
    }
    const heading = HEADING.exec(node.name);
    if (isBlock(node)) {
      flush();
      if (heading) prefix = `${'#'.repeat(Number(heading[1]))} `;
      (node.children || []).forEach(walk);
      flush();
      return;
    }
    (node.children || []).forEach(walk);
  };

  const root = $('body')[0] || $.root()[0];
  (root.children || []).forEach(walk);
  flush();
  return { preheader, body: blocks.join('\n\n') };
}

/**
 * A mailing's text: its subject and preheader, then its body. The preheader
 * is the template's own field when it has one (`preheaderText` in its data),
 * read from the HTML otherwise.
 *
 * @param {{ subject?: string|null, data?: Object }} mailing
 * @param {string} html its sanitised preview
 * @returns {string}
 */
function mailingText(mailing, html) {
  const { preheader: shown, body } = textOfHtml(html);
  const declared = mailing.data && mailing.data.preheaderText;
  const preheader = typeof declared === 'string' ? tidy(declared) : shown;
  return [
    mailing.subject && `Subject: ${tidy(mailing.subject)}`,
    preheader && `Preheader: ${preheader}`,
    body,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// The syntaxes of the ESPs, as written in a template: `{{firstname}}` or
// `{{{firstname}}}`, `%%FirstName%%`, `[[firstname]]`.
const VARIABLES = [
  /\{\{\{?\s*([^{}]+?)\s*\}?\}\}/g,
  /%%([A-Za-z][A-Za-z0-9_]*)%%/g,
  /\[\[\s*([^[\]]+?)\s*\]\]/g,
];
// The control words of a template language, not variables.
const CONTROL = /^[#/^!>]|^else\b/;

/**
 * The personalization variables of a mailing, by name, each once: in its
 * subject and its HTML, text and attributes alike, whatever format is read.
 *
 * @param {{ subject?: string|null }} mailing
 * @param {string|null} html its sanitised preview
 * @returns {string[]}
 */
function variablesOf(mailing, html) {
  const content = `${mailing.subject || ''}\n${html || ''}`;
  const found = VARIABLES.flatMap((pattern) =>
    [...content.matchAll(pattern)].map((match) => match[1].trim())
  );
  return [...new Set(found.filter((name) => name && !CONTROL.test(name)))];
}

module.exports = { mailingText, variablesOf };

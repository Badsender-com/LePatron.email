'use strict';

const cheerio = require('cheerio');
const {
  VARIABLE_PATTERNS,
} = require('../translation/variable-placeholder.utils.js');

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
// The padding a preheader carries so that the client shows nothing after it.
const INVISIBLE = new RegExp(
  [0x200b, 0x200c, 0x200d, 0x034f, 0x00ad, 0x2060, 0xfeff]
    .map((code) => String.fromCharCode(code))
    .join('|'),
  'g'
);
const LINKABLE = /^(https?:|mailto:|tel:|\{\{|%%|\[\[)/i;

const clean = (text) => text.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();

const isHidden = (node) =>
  /display\s*:\s*none/i.test((node.attribs && node.attribs.style) || '');

// The words of an element, images by their alternative text.
function wordsOf(node) {
  if (node.type === 'text') return node.data;
  if (node.type !== 'tag' || SKIPPED.has(node.name)) return '';
  if (node.name === 'img')
    return ` ${(node.attribs && node.attribs.alt) || ''} `;
  if (node.name === 'br') return ' ';
  return (node.children || []).map(wordsOf).join('');
}

/**
 * The text of a mailing's HTML, as Markdown blocks: a heading after `#`, a link
 * as `[label](href)`, an image by its alternative text. Hidden elements are
 * left out, but the first one, before any visible word, is the preheader.
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

  const flush = () => {
    const text = clean(line);
    if (text) blocks.push(`${prefix}${text}`);
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
      if (preheader === null && blocks.length === 0 && !clean(line)) {
        preheader = clean(wordsOf(node)) || null;
      }
      return;
    }
    if (node.name === 'br') {
      flush();
      return;
    }
    if (node.name === 'img') {
      line += wordsOf(node);
      return;
    }
    const href =
      node.name === 'a' && ((node.attribs && node.attribs.href) || '');
    if (href && LINKABLE.test(href.trim())) {
      const label = clean(wordsOf(node));
      line += label ? ` [${label}](${href.trim()}) ` : ` ${href.trim()} `;
      return;
    }
    const heading = /^h([1-6])$/.exec(node.name);
    if (heading || BLOCKS.has(node.name)) {
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
 * A mailing's text: its subject and preheader, then its body.
 *
 * @param {{ subject?: string|null }} mailing
 * @param {string} html its sanitised preview
 * @returns {string}
 */
function mailingText(mailing, html) {
  const { preheader, body } = textOfHtml(html);
  return [
    mailing.subject && `Subject: ${clean(mailing.subject)}`,
    preheader && `Preheader: ${preheader}`,
    body,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// The control words of a template language, not variables.
const CONTROL = /^[#/^!>]|^else\b/;

/**
 * The personalization variables a content holds, by name, each once:
 * `{{firstname}}`, `%%FIRSTNAME%%`, `[[firstname]]`, the syntaxes the
 * translation keeps untouched.
 *
 * @param {string} content
 * @returns {string[]}
 */
function variablesOf(content) {
  const found = [];
  VARIABLE_PATTERNS.filter(({ name }) => name !== 'badsender').forEach(
    ({ regex }) => {
      (String(content).match(new RegExp(regex.source, 'g')) || []).forEach(
        (match) => {
          const name = match
            .replace(/^(\{\{|%%|\[\[)|(\}\}|%%|\]\])$/g, '')
            .trim();
          if (name && !CONTROL.test(name)) found.push(name);
        }
      );
    }
  );
  return [...new Set(found)];
}

module.exports = { mailingText, variablesOf };

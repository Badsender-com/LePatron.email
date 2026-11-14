'use strict';

/**
 * The template contract (ADR-0024): what a template declares and reads at its
 * root. It decides which dimensions an email of that template offers, and where
 * their values are adopted from.
 *
 * - `declared`: the template's root properties, from the `properties` of its
 *   `template { }` definition, each with the default the template gives it
 *   (`silo=youth`), or an empty string.
 * - `read`: every root property an expression reads as `_root_.x`, in a display
 *   condition, a style or an attribute binding. A design token is read this way.
 * - `adopt`: for a property, the source its value is adopted from when the
 *   template renamed it (`siloBrand { adopt: brand_[silo]; }`).
 *
 * Read by scanning the markup rather than by running Mosaico, which needs a
 * browser: the definitions live in the template's `<style>` blocks, in a syntax
 * a template integrator writes by hand (TEMPLATE_DEVELOPER_GUIDE.md). Each
 * scan goes through the markup once: it is read on user requests, and an
 * expression that backtracks would let a malformed template hold the server.
 */

const ROOT_READ = /_root_\.([A-Za-z_][A-Za-z0-9_]*)/g;
const IDENTIFIER_CHAR = /[A-Za-z0-9_]/;
const WHITESPACE = /\s/;

// Raised each time the reader reads differently: a contract stored by an older
// reader is read again on its next need (template-contract.service.js).
// 2: comments other than Outlook's conditional ones are not read.
const CONTRACT_READER_VERSION = 2;

module.exports = {
  readTemplateContract,
  refreshContract,
  CONTRACT_READER_VERSION,
};

/**
 * Read a template's contract again when its markup changed: called before a
 * template document is saved, a creation or an upload of new markup.
 *
 * @param {Object} template a Mongoose template document
 */
function refreshContract(template) {
  if (!template.isNew && !template.isModified('markup')) return;
  template.contract = readTemplateContract(template.markup);
  template.contractVersion = CONTRACT_READER_VERSION;
  template.markModified('contract');
}

/**
 * @param {string} [markup] a template's HTML
 * @returns {{declared: Object<string, string>, read: string[], adopt: Object<string, string>}}
 */
function readTemplateContract(markup) {
  if (typeof markup !== 'string' || markup === '') {
    return { declared: {}, read: [], adopt: {} };
  }

  const definitions = definitionsOf(markup);
  return {
    declared: declaredProperties(definitions.get('template')),
    read: rootReads(withoutPlainComments(markup)),
    adopt: adoptionSources(definitions),
  };
}

function rootReads(markup) {
  return [
    ...new Set([...markup.matchAll(ROOT_READ)].map((match) => match[1])),
  ].sort();
}

// The definitions of every `<style>` block, by name. A name defined twice keeps
// its last body, as in a stylesheet.
function definitionsOf(markup) {
  const definitions = new Map();
  styleBlocks(markup).forEach((css) => {
    definitionsIn(css).forEach(([name, body]) => definitions.set(name, body));
  });
  return definitions;
}

function styleBlocks(markup) {
  const lower = markup.toLowerCase();
  const blocks = [];
  let from = 0;
  for (;;) {
    const open = lower.indexOf('<style', from);
    const start = open === -1 ? -1 : lower.indexOf('>', open);
    const end = start === -1 ? -1 : lower.indexOf('</style>', start);
    if (end === -1) return blocks;
    blocks.push(markup.slice(start + 1, end));
    from = end + '</style>'.length;
  }
}

// One definition `name { ... }`: Mosaico's definitions hold no nested braces,
// so a body is what lies between a `{` and the next `}` with no `{` between.
function definitionsIn(css) {
  const found = [];
  let open = -1;
  for (let at = 0; at < css.length; at += 1) {
    if (css[at] === '{') open = at;
    else if (css[at] === '}' && open !== -1) {
      const name = nameBefore(css, open);
      if (name) found.push([name, css.slice(open + 1, at)]);
      open = -1;
    }
  }
  return found;
}

// The identifier right before a `{`, spaces allowed between: it starts with a
// letter or an underscore.
function nameBefore(css, brace) {
  let end = brace;
  while (end > 0 && WHITESPACE.test(css[end - 1])) end -= 1;
  let start = end;
  while (start > 0 && IDENTIFIER_CHAR.test(css[start - 1])) start -= 1;
  while (start < end && /[0-9]/.test(css[start])) start += 1;
  return start < end ? css.slice(start, end) : null;
}

// A comment documents, it reads nothing. An Outlook conditional comment
// (`<!--[if mso]>`) holds markup, bindings included: it is kept, and so is
// the `<!-->` that opens the markup hidden from Outlook only.
function withoutPlainComments(markup) {
  let kept = '';
  let from = 0;
  for (;;) {
    const open = markup.indexOf('<!--', from);
    if (open === -1) return kept + markup.slice(from);
    const after = open + '<!--'.length;
    if (markup.startsWith('[if', after) || markup[after] === '>') {
      kept += markup.slice(from, after);
      from = after;
    } else {
      const close = markup.indexOf('-->', after);
      if (close === -1) return kept + markup.slice(from);
      kept += markup.slice(from, open);
      from = close + '-->'.length;
    }
  }
}

// The value of one `key: value;` entry of a definition body.
function entryOf(body, key) {
  const match = new RegExp(`(?:^|;|\\s)${key}\\s*:\\s*([^;]*)`).exec(
    body || ''
  );
  return match ? match[1].trim() : null;
}

function declaredProperties(templateBody) {
  const properties = entryOf(templateBody, 'properties');
  if (!properties) return {};
  return properties
    .split(/\s+/)
    .filter(Boolean)
    .reduce((declared, property) => {
      const [name, ...value] = property.split('=');
      return { ...declared, [name]: value.join('=') };
    }, {});
}

function adoptionSources(definitions) {
  const adopt = {};
  definitions.forEach((body, name) => {
    const source = entryOf(body, 'adopt');
    if (source) adopt[name] = source;
  });
  return adopt;
}

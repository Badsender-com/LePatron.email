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
 * - `compared`: the literals the template compares a root property against and
 *   how many times (`_root_.market eq 'be'` →
 *   `[{ property: 'market', literal: 'be', count: 1 }]`), read to show the
 *   impact of changing a value's identifier (ADR-0026). A list rather than an
 *   object keyed by literal: a literal is markup, and as a key it could hold a
 *   dot Mongo refuses to store, or a name an object reserves.
 * - `comparedTogether`: two root properties compared in one binding
 *   expression (`_root_.market eq 'ca' and _root_.language eq 'fr'`), and how
 *   many times: the template expects that combination of values, which the
 *   taxonomy may not offer (ADR-0026). Comparisons in nested elements are not
 *   paired: one expression is read at a time.
 *
 * Read by scanning the markup rather than by running Mosaico, which needs a
 * browser: the definitions live in the template's `<style>` blocks, in a syntax
 * a template integrator writes by hand (TEMPLATE_DEVELOPER_GUIDE.md). Each
 * scan goes through the markup once: it is read on user requests, and an
 * expression that backtracks would let a malformed template hold the server.
 */

const ROOT_READ = /_root_\.([A-Za-z_][A-Za-z0-9_]*)/g;
// `_root_.x eq 'literal'`, `neq`, `==` or `!=`, single or double quotes, on
// either side. A word operator stands between spaces, so `_root_.marketneq` is
// no comparison. Each part is a run of one class of characters, ended by a
// character it cannot hold: nothing to backtrack on.
const OPERATOR = String.raw`(?:\s+n?eq\s+|\s*[!=]==?\s*)`;
const PROPERTY = String.raw`_root_\.([A-Za-z_][A-Za-z0-9_]*)`;
const LITERAL = String.raw`(?:'([^']*)'|"([^"]*)")`;
const ROOT_COMPARED = new RegExp(
  `${PROPERTY}${OPERATOR}${LITERAL}|${LITERAL}${OPERATOR}${PROPERTY}`,
  'g'
);
// A binding attribute and its expression, between either quotes.
const BINDING_ATTRIBUTE = /\sdata-ko-[\w-]+\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
// Quotes a template wrote as entities inside an attribute.
const QUOTE_ENTITIES = [
  [/&quot;|&#0*34;|&#x0*22;/gi, '"'],
  [/&apos;|&#0*39;|&#x0*27;/gi, "'"],
];
const IDENTIFIER_CHAR = /[A-Za-z0-9_]/;
const WHITESPACE = /\s/;

// Raised each time the reader reads differently: a contract stored by an older
// reader is read again on its next need (template-contract.service.js).
// 2: comments other than Outlook's conditional ones are not read.
// 3: the literals a root property is compared against are recorded.
// 4: they are recorded as a list, and read on either side of the operator.
// 5: the comparisons made together in one expression are recorded.
const CONTRACT_READER_VERSION = 5;

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
 * @returns {{declared: Object<string, string>, read: string[], adopt: Object<string, string>, compared: Array<{property: string, literal: string, count: number}>, comparedTogether: Array<{property: string, literal: string, withProperty: string, withLiteral: string, count: number}>}}
 */
function readTemplateContract(markup) {
  if (typeof markup !== 'string' || markup === '') {
    return {
      declared: {},
      read: [],
      adopt: {},
      compared: [],
      comparedTogether: [],
    };
  }

  const definitions = definitionsOf(markup);
  const bindings = withoutPlainComments(markup);
  return {
    declared: declaredProperties(definitions.get('template')),
    read: rootReads(bindings),
    adopt: adoptionSources(definitions),
    compared: rootComparisons(bindings),
    comparedTogether: comparisonsTogether(bindings),
  };
}

const decodeQuotes = (text) =>
  QUOTE_ENTITIES.reduce(
    (decoded, [entity, quote]) => decoded.replace(entity, quote),
    text
  );

// Every `_root_.x eq 'literal'` of a text, in order.
function comparisonsIn(text) {
  return [...decodeQuotes(text).matchAll(ROOT_COMPARED)].map((match) => ({
    property: match[1] || match[6],
    literal: [match[2], match[3], match[4], match[5]].find(
      (part) => part !== undefined
    ),
  }));
}

// Counted by their fields and sorted by them: the list a contract stores.
function counted(entries, fields) {
  const counts = new Map();
  entries.forEach((entry) => {
    const key = JSON.stringify(fields.map((field) => entry[field]));
    const known = counts.get(key) || { ...entry, count: 0 };
    known.count += 1;
    counts.set(key, known);
  });
  return [...counts.values()].sort((a, b) =>
    fields.reduce((order, field) => order || compareText(a[field], b[field]), 0)
  );
}

function rootComparisons(markup) {
  return counted(comparisonsIn(markup), ['property', 'literal']);
}

function comparisonsTogether(markup) {
  const pairs = [];
  [...markup.matchAll(BINDING_ATTRIBUTE)].forEach((attribute) => {
    const found = comparisonsIn(attribute[1] ?? attribute[2]);
    found.forEach((first, index) => {
      found.slice(index + 1).forEach((second) => {
        if (first.property === second.property) return;
        const [a, b] =
          first.property < second.property ? [first, second] : [second, first];
        pairs.push({
          property: a.property,
          literal: a.literal,
          withProperty: b.property,
          withLiteral: b.literal,
        });
      });
    });
  });
  return counted(pairs, ['property', 'literal', 'withProperty', 'withLiteral']);
}

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

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

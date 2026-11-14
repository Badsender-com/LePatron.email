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
 * Read with regular expressions rather than by running Mosaico, which needs a
 * browser: the definitions live in the template's `<style>` blocks, in a syntax
 * a template integrator writes by hand (TEMPLATE_DEVELOPER_GUIDE.md).
 */

const STYLE_BLOCK = /<style[^>]*>([\s\S]*?)<\/style>/gi;
// One definition `name { ... }`: Mosaico's definitions hold no nested braces.
const DEFINITION = /([A-Za-z_][A-Za-z0-9_]*)\s*\{([^{}]*)\}/g;
const ROOT_READ = /_root_\.([A-Za-z_][A-Za-z0-9_]*)/g;
// A comment documents, it reads nothing. An Outlook conditional comment
// (`<!--[if mso]>`) holds markup, bindings included: it is kept, and so is
// the `<!-->` that opens the markup hidden from Outlook only.
const PLAIN_COMMENT = /<!--(?!\[if|>)[\s\S]*?-->/g;

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
    read: rootReads(markup.replace(PLAIN_COMMENT, '')),
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
  [...markup.matchAll(STYLE_BLOCK)].forEach(([, css]) => {
    [...css.matchAll(DEFINITION)].forEach(([, name, body]) => {
      definitions.set(name, body);
    });
  });
  return definitions;
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

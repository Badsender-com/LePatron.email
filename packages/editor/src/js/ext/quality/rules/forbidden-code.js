'use strict';

const _ = require('lodash');
const { clientMarkup } = require('../html-code');
const { SANITIZE_CONFIG } = require('../../html-code-block/neutralize-html');

// What no email client runs and every filter distrusts: scripts, embedded
// pages, forms, plug-ins, stylesheets, event handlers and script URLs. The
// canvas already neutralizes them for the preview (neutralize-html.js), so
// the client does not see them misbehave: the export keeps them as pasted.
// The tags and attributes are the canvas's own list, so the two never drift.
const FORBIDDEN_TAGS = SANITIZE_CONFIG.FORBID_TAGS;
const FORBIDDEN_ATTRS = SANITIZE_CONFIG.FORBID_ATTR;
// Every attribute that takes a URL, as the sanitizer reads them.
const URL_ATTRS = [
  'href',
  'src',
  'action',
  'formaction',
  'background',
  'data',
  'poster',
  'xlink:href',
];
// A URL read as a client reads it: whitespace and control characters dropped,
// case ignored, so "java\tscript:" and "JavaScript:" are the same.
// eslint-disable-next-line no-control-regex
const DROPPED = /[\s\x00-\x1f]/g;
const normalizeUrl = (value) => value.replace(DROPPED, '').toLowerCase();
const SCRIPT_URL = /^(javascript|vbscript):|^data:text\/html/;

const isForbiddenAttribute = (name) =>
  name.startsWith('on') || FORBIDDEN_ATTRS.includes(name);

function problemsOf(root) {
  const tags = FORBIDDEN_TAGS.filter((tag) => root.querySelector(tag)).map(
    (tag) => `<${tag}>`
  );
  const elements = Array.from(root.querySelectorAll('*'));
  const attributes = _.flatMap(elements, (el) =>
    Array.from(el.attributes)
      .map((attr) => attr.name.toLowerCase())
      .filter(isForbiddenAttribute)
  );
  const scriptUrls = _.flatMap(elements, (el) =>
    URL_ATTRS.map((name) => el.getAttribute(name))
      .filter((value) => typeof value === 'string')
      .map((value) => SCRIPT_URL.exec(normalizeUrl(value)))
      .filter(Boolean)
      .map((m) => m[0])
  );
  return tags.concat(_.uniq(attributes), _.uniq(scriptUrls));
}

module.exports = {
  id: 'forbidden-code',
  category: 'technical',
  severity: 'error',
  titleKey: 'Forbidden code',
  passKey: 'No code the email clients refuse',
  FORBIDDEN_TAGS,
  run(ctx) {
    return clientMarkup(ctx)
      .map((markup) => ({
        ...markup,
        problems: problemsOf(markup.root).sort(),
      }))
      .filter(({ problems }) => problems.length)
      .map(({ blockId, path, problems }) => ({
        messageKey:
          'Code that email clients never run, and filters distrust: __code__',
        params: { code: problems.join(', ') },
        blockId,
        propertyPath: path,
        value: problems.join('|'),
      }));
  },
};

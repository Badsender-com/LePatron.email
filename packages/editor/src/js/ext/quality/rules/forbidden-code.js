'use strict';

const _ = require('lodash');
const { clientMarkup, parseMarkup } = require('../html-code');

// What no email client runs and every filter distrusts: scripts, embedded
// pages, forms, plug-ins, external stylesheets and event handlers. The canvas
// already neutralizes them for the preview (html-code-block/neutralize-html.js),
// so the client does not see them misbehave: the export keeps them as pasted.
const FORBIDDEN_TAGS = ['script', 'iframe', 'form', 'embed', 'object', 'applet'];

function problemsOf(root) {
  const tags = FORBIDDEN_TAGS.filter((tag) => root.querySelector(tag)).map(
    (tag) => `<${tag}>`
  );
  if (root.querySelector('link[rel~="stylesheet" i]')) {
    tags.push('<link rel="stylesheet">');
  }
  const handlers = _.uniq(
    _.flatMap(Array.from(root.querySelectorAll('*')), (el) =>
      Array.from(el.attributes)
        .map((attr) => attr.name.toLowerCase())
        .filter((name) => name.startsWith('on'))
    )
  );
  if (handlers.length) tags.push(handlers.join(', '));
  if (root.querySelector('[href^="javascript:" i],[src^="javascript:" i]')) {
    tags.push('javascript:');
  }
  return tags;
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
      .map((markup) => ({ ...markup, problems: problemsOf(parseMarkup(ctx, markup.html)) }))
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

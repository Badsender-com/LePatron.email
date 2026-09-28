'use strict';

const { htmlCodeBlocks, parseMarkup } = require('../html-code');

// HTML and CSS a part of the audience's clients ignore (caniemail): layouts
// built on them fall apart in Gmail or Outlook. The template's own code was
// tested by Badsender; only the code pasted in HTML code blocks is read.
const FEATURES = [
  { name: 'flexbox', test: (css) => /display\s*:\s*(inline-)?flex\b/i.test(css) },
  { name: 'grid', test: (css) => /display\s*:\s*(inline-)?grid\b/i.test(css) },
  {
    name: 'position: absolute/fixed/sticky',
    test: (css) => /position\s*:\s*(absolute|fixed|sticky)\b/i.test(css),
  },
  { name: 'CSS variables', test: (css) => /var\(\s*--/i.test(css) },
  { name: '@import', test: (css) => /@import\b/i.test(css) },
  { name: 'data: images in CSS', test: (css) => /url\(\s*['"]?data:/i.test(css) },
];

// All the CSS of a piece of markup: <style> contents and inline styles.
function cssOf(root) {
  return Array.from(root.querySelectorAll('style'))
    .map((el) => el.textContent)
    .concat(Array.from(root.querySelectorAll('[style]')).map((el) => el.getAttribute('style')))
    .join('\n');
}

function unsupportedIn(root) {
  const css = cssOf(root);
  const found = FEATURES.filter((feature) => feature.test(css)).map((f) => f.name);
  if (root.querySelector('svg')) found.push('<svg>');
  if (root.querySelector('video, audio')) found.push('<video>/<audio>');
  if (root.querySelector('img[src^="data:" i]')) found.push('data: images');
  return found;
}

module.exports = {
  id: 'unsupported-code',
  category: 'technical',
  severity: 'warning',
  titleKey: 'Email-safe code',
  passKey: 'The code of HTML code blocks only uses what email clients support',
  run(ctx) {
    return htmlCodeBlocks(ctx)
      .map((block) => ({ ...block, found: unsupportedIn(parseMarkup(ctx, block.html)) }))
      .filter(({ found }) => found.length)
      .map(({ blockId, found }) => ({
        messageKey:
          'HTML code uses what some email clients ignore: __features__',
        params: { features: found.join(', ') },
        blockId,
        propertyPath: 'htmlCode',
        value: found.join('|'),
      }));
  },
};

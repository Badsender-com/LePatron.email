'use strict';

const { htmlCodeBlocks, stripCssComments } = require('../html-code');

// HTML and CSS a part of the audience's clients ignore (caniemail): layouts
// built on them fall apart in Gmail or Outlook. The template's own code was
// tested by Badsender; only the code pasted in HTML code blocks is read.
// Each is named by the code itself, which needs no translation.
const FEATURES = [
  {
    pattern: /display\s*:\s*((?:inline-)?(?:flex|grid))\b/i,
    name: (m) => `display:${m[1].toLowerCase()}`,
  },
  {
    pattern: /position\s*:\s*(absolute|fixed|sticky)\b/i,
    name: (m) => `position:${m[1].toLowerCase()}`,
  },
  { pattern: /var\(\s*--/i, name: () => 'var(--…)' },
  { pattern: /@import\b/i, name: () => '@import' },
  { pattern: /url\(\s*['"]?data:/i, name: () => 'url(data:…)' },
];

// All the CSS of a piece of markup: <style> contents and inline styles,
// comments left out.
function cssOf(root) {
  return stripCssComments(
    Array.from(root.querySelectorAll('style'))
      .map((el) => el.textContent)
      .concat(
        Array.from(root.querySelectorAll('[style]')).map((el) =>
          el.getAttribute('style')
        )
      )
      .join('\n')
  );
}

function unsupportedIn(root) {
  const css = cssOf(root);
  const found = FEATURES.map((feature) => {
    const m = feature.pattern.exec(css);
    return m && feature.name(m);
  }).filter(Boolean);
  if (root.querySelector('svg')) found.push('<svg>');
  if (root.querySelector('video, audio')) found.push('<video>/<audio>');
  if (root.querySelector('img[src^="data:" i]'))
    found.push('<img src="data:…">');
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
      .map((block) => ({ ...block, found: unsupportedIn(block.root).sort() }))
      .filter(({ found }) => found.length)
      .map(({ blockId, path, found }) => ({
        messageKey:
          'HTML code uses what some email clients ignore: __features__',
        params: { features: found.join(', ') },
        blockId,
        propertyPath: path,
        value: found.join('|'),
      }));
  },
};

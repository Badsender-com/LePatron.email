'use strict';

// Tailwind in, inline styles out — and only styles an email client reads.
//
// Inlined rather than left as classes because the block travels into other
// people's templates: it can rely on no stylesheet but its own. Two kinds of
// failure used to pass silently: a utility Tailwind emits in a form email
// clients drop (a custom property, a `rem`), and a class that inlines to
// nothing at all (a typo, a utility that needs a combinator or a media query).
// Both now fail the build, naming the class.

const postcss = require('postcss');
const tailwind = require('tailwindcss');
const juice = require('juice');

const config = require('./tailwind.config.js');
const {
  isGeneratedClass,
} = require('../../packages/shared/block-builder/generated-classes.js');
const { SENTINEL_PREFIX } = require('./markup-pipeline.js');

// A slot can land in a `class` attribute — a layout's stacking class is one —
// and at this point it is still a sentinel. It is neither a utility to inline
// nor dead weight to strip: it is a hole the generator fills with a name it
// owns, so it is left exactly as it is.
const isSentinel = (name) => name.startsWith(SENTINEL_PREFIX);
const isOurs = (name) => isGeneratedClass(name) || isSentinel(name);

// What email clients drop, and why it is refused rather than shipped.
const UNSAFE = [
  [/var\(/, 'var(), which email clients do not resolve'],
  [/--tw-/, 'a Tailwind custom property, which email clients ignore'],
  [/(^|[^\w.-])-?\d*\.?\d+rem\b/, 'a rem unit, which several clients ignore'],
  [/text-decoration-line/, 'text-decoration-line, which Outlook ignores'],
  // What an opacity modifier (`bg-red-500/50`) still produces with the
  // opacity plugins off: the space-separated syntax older clients cannot read.
  [
    /rgba?\(\s*[\d.]+%?\s+[\d.]/,
    'a space-separated rgb(), which older clients ignore',
  ],
];

const unsafeIn = (css) => UNSAFE.find(([pattern]) => pattern.test(css));

const unescapeSelector = (selector) => selector.replace(/\\(.)/g, '$1');

/**
 * @param {string} html
 * @returns {Array<string>} every class the markup uses, once
 */
function classesOf(html) {
  const classes = new Set();
  html.replace(/\sclass="([^"]*)"/g, (_, list) => {
    list
      .split(/\s+/)
      .filter(Boolean)
      .forEach((c) => classes.add(c));
    return '';
  });
  return [...classes];
}

/**
 * The declarations each class gets from a rule juice can inline: a top-level
 * rule whose selector is that class alone. A combinator (`space-y-2`), a
 * pseudo-class or a media query would leave the class with nothing inline.
 *
 * @param {Object} root the PostCSS root Tailwind produced
 * @returns {Map<string, Array<string>>} class -> `prop: value` declarations
 */
function inlinableDeclarations(root) {
  const byClass = new Map();
  root.each((node) => {
    if (node.type !== 'rule') return;
    node.selectors.forEach((selector) => {
      if (!/^\.(?:\\.|[^\s.:>+~[\]#])+$/.test(selector)) return;
      const name = unescapeSelector(selector.slice(1));
      const declarations = byClass.get(name) || [];
      node.walkDecls((decl) => {
        declarations.push(`${decl.prop}: ${decl.value}`);
      });
      byClass.set(name, declarations);
    });
  });
  return byClass;
}

function checkClass(label, name, declarations) {
  // A colon outside brackets is a variant: `sm:`, `hover:`. An arbitrary
  // property (`[mso-hide:all]`) has its colon inside, and inlines fine.
  if (name.replace(/\[[^\]]*\]/g, '').includes(':')) {
    throw new Error(
      `${label}: "${name}" is a responsive or state variant. Those need a ` +
        'media query or a selector in the document head, and that channel ' +
        'is not wired to the generator yet.'
    );
  }
  if (!declarations || declarations.length === 0) {
    throw new Error(
      `${label}: the class "${name}" inlines to nothing — unknown to the ` +
        'email Tailwind config, disabled in it, or a utility that needs a ' +
        'selector inline styles cannot express.'
    );
  }
  const css = declarations.join('; ');
  const unsafe = unsafeIn(css);
  if (unsafe) {
    throw new Error(
      `${label}: the class "${name}" emits ${unsafe[1]} (${css}).`
    );
  }
}

/**
 * Whatever reached a `style` attribute, hand-written ones included.
 */
function checkInlineStyles(label, html) {
  html.replace(/\sstyle="([^"]*)"/g, (_, style) => {
    const unsafe = unsafeIn(style);
    if (unsafe) {
      throw new Error(`${label}: a style contains ${unsafe[1]}: "${style}".`);
    }
    return '';
  });
}

/**
 * Resolves the Tailwind classes the markup uses, checks them, inlines them,
 * and drops the class attributes.
 *
 * @param {string} html
 * @param {string} label e.g. `button (default)`, for the messages
 * @returns {Promise<string>}
 */
async function inlineStyles(html, label) {
  const { root, css } = await postcss([
    tailwind({ ...config, content: [{ raw: html, extension: 'html' }] }),
  ]).process('@tailwind utilities;', { from: undefined });

  const declarations = inlinableDeclarations(root);
  // A class the generator owns is not a utility that failed to inline: it is
  // one that MUST NOT be, because it only means anything inside a media query.
  // Checking it the same way would refuse exactly the thing it is there for.
  classesOf(html)
    .filter((name) => !isOurs(name))
    .forEach((name) => checkClass(label, name, declarations.get(name)));

  const inlined = juice.inlineContent(html, css, { removeStyleTags: true });
  checkInlineStyles(label, inlined);

  return keepGeneratedClasses(inlined);
}

/**
 * Drops the class names juice has finished with, keeps the ones we emit.
 *
 * juice folds a utility's rules into `style` but leaves its name behind, and a
 * class nothing defines is dead weight in every email that ships — every
 * utility was just checked to inline completely, so none of those needs to
 * survive. The generator's own classes are the opposite case: nothing inlined
 * them, and the stylesheet in the document head is about to refer to them by
 * name. Stripping all of them is what made a responsive rule impossible.
 *
 * @param {string} html
 * @returns {string}
 */
function keepGeneratedClasses(html) {
  return html.replace(/\s+class="([^"]*)"/g, (whole, list) => {
    const kept = list.split(/\s+/).filter(isOurs);
    return kept.length ? ` class="${kept.join(' ')}"` : '';
  });
}

module.exports = { inlineStyles };

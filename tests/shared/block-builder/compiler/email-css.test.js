'use strict';

// The Tailwind the components may use is the subset email clients read, and
// the build refuses the rest by name rather than shipping it.

const { compileFixture } = require('./fixture.js');

const slots = { label: { context: 'TEXT' } };
const withClass = (classes, style = '') =>
  compileFixture({
    slots,
    template: `<table><tr><td class="${classes}"${
      style ? ` style="${style}"` : ''
    }>{{ label }}</td></tr></table>`,
  });

describe('the email Tailwind config', () => {
  it.each([
    ['inline-block', 'display: inline-block'],
    ['p-4', 'padding: 16px'],
    ['text-base', 'font-size: 16px; line-height: 24px'],
    ['rounded', 'border-radius: 4px'],
    ['max-w-md', 'max-width: 448px'],
    ['text-red-500', 'color: #ef4444'],
    ['bg-red-500', 'background-color: #ef4444'],
    ['underline', 'text-decoration: underline'],
    ['no-underline', 'text-decoration: none'],
    ['[mso-hide:all]', 'mso-hide: all'],
  ])('inlines %s as %s', async (classes, css) => {
    const { default: html } = await withClass(classes);
    expect(html).toContain(`style="${css};"`);
    expect(html).not.toContain('class=');
  });
});

describe('the build refuses', () => {
  it.each([
    ['an unknown class', 'not-a-utility', /"not-a-utility" inlines to nothing/],
    [
      'a utility that needs a combinator',
      'space-y-2',
      /"space-y-2" inlines to nothing/,
    ],
    [
      'a responsive variant',
      'sm:p-2',
      /"sm:p-2" is a responsive or state variant/,
    ],
    ['a state variant', 'hover:underline', /"hover:underline" is a responsive/],
    [
      'a utility built on custom properties',
      'rotate-45',
      /"rotate-45" emits var\(\)/,
    ],
    ['a shadow, built on custom properties', 'shadow', /"shadow" emits/],
    [
      'an opacity modifier',
      'bg-red-500/50',
      /"bg-red-500\/50" emits a space-separated rgb\(\)/,
    ],
    ['an arbitrary rem value', 'p-[1rem]', /"p-\[1rem\]" emits a rem unit/],
  ])('%s', async (_, classes, message) => {
    await expect(withClass(classes)).rejects.toThrow(message);
  });

  it.each([
    ['a rem unit', 'padding: 1.5rem', /a rem unit/],
    ['var()', 'color: var(--brand)', /var\(\)/],
    ['a --tw- property', '--tw-ring-color: red', /custom property/],
    [
      'text-decoration-line',
      'text-decoration-line: none',
      /text-decoration-line/,
    ],
  ])('%s in a hand-written style', async (_, style, message) => {
    await expect(withClass('inline-block', style)).rejects.toThrow(message);
  });
});

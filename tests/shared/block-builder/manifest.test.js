'use strict';

// The manifest (components/*.slots.js) is the one place an element's initial
// values are written: the compiler derives the fallbacks from it, the element
// modules their defaults.

const path = require('path');

const {
  fallbackOf,
  defaultsOf,
} = require('../../../packages/shared/block-builder/manifest.js');
const {
  ELEMENTS,
} = require('../../../packages/shared/block-builder/elements/index.js');
const { compileFixture } = require('./compiler/fixture.js');

const COMPONENTS = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'shared',
  'block-builder',
  'components'
);

describe('fallbackOf', () => {
  it('is the default, as a string', () => {
    expect(fallbackOf({ context: 'PX', default: 28 })).toBe('28');
  });

  it('is the explicit fallback when the manifest gives one', () => {
    expect(fallbackOf({ context: 'URL', default: '', fallback: '#' })).toBe(
      '#'
    );
  });
});

describe('the elements take their defaults from the manifest', () => {
  test.each(ELEMENTS.map((element) => [element.type, element]))(
    '%s',
    (type, element) => {
      const manifest = require(path.join(COMPONENTS, `${type}.slots.js`));
      expect(element.defaults).toEqual(defaultsOf(manifest));

      // The editor coerces a stored value to the type of its default.
      Object.entries(manifest.slots).forEach(([name, slot]) => {
        expect(typeof element.defaults[name]).toBe(
          slot.context === 'PX' ? 'number' : 'string'
        );
      });
    }
  );
});

describe('the compiler refuses a default of the wrong type', () => {
  const template = '<table><tr><td :width="size">a</td></tr></table>';

  it.each([
    ['a string for a PX slot', { context: 'PX', default: '28' }, /integer/],
    ['no default at all', { context: 'PX', default: undefined }, /integer/],
    ['a number for an ATTR slot', { context: 'ATTR', default: 28 }, /string/],
  ])('%s', async (_, slot, message) => {
    await expect(
      compileFixture({ slots: { size: slot }, template })
    ).rejects.toThrow(message);
  });
});

describe('the compiler refuses a fallback that would not survive', () => {
  const template = '<table><tr><td :bgcolor="tint">a</td></tr></table>';

  it.each([
    ['a ] that would end the placeholder', '#fff]', /contains \[, \] or \|/],
    ['a [ in it', '[#fff', /contains \[, \] or \|/],
    ['a | that would cut it short', '#fff|#000', /contains \[, \] or \|/],
    ['a value its own context refuses', 'red;x:y', /not a valid COLOR value/],
  ])('%s', async (_, fallback, message) => {
    await expect(
      compileFixture({
        slots: { tint: { context: 'COLOR', default: '#ffffff', fallback } },
        template,
      })
    ).rejects.toThrow(message);
  });

  it('checks a fallback derived from the default too', async () => {
    await expect(
      compileFixture({
        slots: { tint: { context: 'COLOR', default: 'not a colour' } },
        template,
      })
    ).rejects.toThrow(/"not a colour" is not a valid COLOR value/);
  });

  it('refuses a URL fallback with a scheme the URL context refuses', async () => {
    await expect(
      compileFixture({
        slots: {
          link: { context: 'URL', default: '', fallback: 'javascript:void(0)' },
        },
        template: '<table><tr><td><a :href="link">a</a></td></tr></table>',
      })
    ).rejects.toThrow(/not a valid URL value/);
  });
});

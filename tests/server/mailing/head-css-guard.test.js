'use strict';

// The rule that needs pinning is the one about turning the flag OFF after CSS
// was written: the author must keep being able to save their email, and to
// clear the CSS, without being able to write new CSS. Getting that backwards
// locks people out of their own work.

const {
  isHeadCssEnabled,
  validateHeadCss,
  bringsDisallowedHeadCss,
  assertHeadCssAllowed,
  hasHeadCss,
  headCssToExport,
  HEAD_CSS_MAX_LENGTH,
} = require('../../../packages/server/mailing/head-css-guard.js');

const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

describe('isHeadCssEnabled', () => {
  test.each([
    [
      'a template with the HTML code block flag',
      { htmlBlockEnabled: true },
      true,
    ],
    ['a template without it', { htmlBlockEnabled: false }, false],
    ['a template that predates the flag', {}, false],
    ['no template at all', null, false],
  ])('is %s -> %s', (_label, template, expected) => {
    expect(isHeadCssEnabled(template)).toBe(expected);
  });
});

describe('validateHeadCss', () => {
  test('accepts CSS up to the limit', () => {
    const css = 'a'.repeat(HEAD_CSS_MAX_LENGTH);
    expect(validateHeadCss(css)).toEqual({
      valid: true,
      length: HEAD_CSS_MAX_LENGTH,
      maxLength: HEAD_CSS_MAX_LENGTH,
    });
  });

  test('refuses one character past it', () => {
    const css = 'a'.repeat(HEAD_CSS_MAX_LENGTH + 1);
    expect(validateHeadCss(css).valid).toBe(false);
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', {}],
  ])('treats %s as no CSS at all', (_label, css) => {
    expect(validateHeadCss(css)).toMatchObject({ valid: true, length: 0 });
  });

  test('honours an explicit limit', () => {
    expect(validateHeadCss('abcdef', 5).valid).toBe(false);
    expect(validateHeadCss('abcde', 5).valid).toBe(true);
  });
});

describe('hasHeadCss', () => {
  test.each([
    ['CSS', '.a{color:red}', true],
    ['an empty string', '', false],
    ['whitespace only', '  \n\t ', false],
    ['undefined', undefined, false],
  ])('is %s -> %s', (_label, css, expected) => {
    expect(hasHeadCss(css)).toBe(expected);
  });
});

describe('bringsDisallowedHeadCss', () => {
  describe('with the flag on', () => {
    test('allows anything', () => {
      expect(
        bringsDisallowedHeadCss({
          css: '.a{color:red}',
          previousCss: '',
          headCssEnabled: true,
        })
      ).toBe(false);
    });
  });

  describe('with the flag off', () => {
    const off = { headCssEnabled: false };

    test('refuses new CSS', () => {
      expect(
        bringsDisallowedHeadCss({
          ...off,
          css: '.a{color:red}',
          previousCss: '',
        })
      ).toBe(true);
    });

    test('refuses a change to stored CSS', () => {
      expect(
        bringsDisallowedHeadCss({
          ...off,
          css: '.a{color:blue}',
          previousCss: '.a{color:red}',
        })
      ).toBe(true);
    });

    test('accepts saving the mailing with its stored CSS unchanged', () => {
      expect(
        bringsDisallowedHeadCss({
          ...off,
          css: '.a{color:red}',
          previousCss: '.a{color:red}',
        })
      ).toBe(false);
    });

    test('accepts clearing the CSS', () => {
      expect(
        bringsDisallowedHeadCss({
          ...off,
          css: '',
          previousCss: '.a{color:red}',
        })
      ).toBe(false);
    });

    test('accepts a mailing that never had any', () => {
      expect(
        bringsDisallowedHeadCss({
          ...off,
          css: undefined,
          previousCss: undefined,
        })
      ).toBe(false);
    });
  });
});

describe('assertHeadCssAllowed', () => {
  test('throws HEAD_CSS_DISABLED on disallowed CSS', () => {
    expect(() =>
      assertHeadCssAllowed({
        css: '.a{color:red}',
        previousCss: '',
        headCssEnabled: false,
      })
    ).toThrow(ERROR_CODES.HEAD_CSS_DISABLED);
  });

  test('stays silent when the CSS is allowed', () => {
    expect(() =>
      assertHeadCssAllowed({
        css: '.a{color:red}',
        previousCss: '',
        headCssEnabled: true,
      })
    ).not.toThrow();
  });
});

// The CSS follows the HTML code blocks, not the flag: what the server writes
// into a stored copy (a translated duplicate's previewHtml) obeys the editor's
// export rule. The flag plays no part here — it gates writing the CSS, above.
describe('headCssToExport', () => {
  const CSS = '.a{color:red}';
  const block = { type: 'htmlCodeBlock', htmlCode: '<p>x</p>' };

  test('is the CSS while the content holds an HTML code block', () => {
    expect(
      headCssToExport({
        data: { mainBlocks: { blocks: [block] } },
        headCss: CSS,
      })
    ).toBe(CSS);
  });

  test('looks at every top-level container', () => {
    expect(
      headCssToExport({
        data: { mainBlocks: { blocks: [] }, footerBlocks: { blocks: [block] } },
        headCss: CSS,
      })
    ).toBe(CSS);
  });

  test('is nothing without any HTML code block', () => {
    expect(
      headCssToExport({
        data: { mainBlocks: { blocks: [{ type: 'textBlock' }] } },
        headCss: CSS,
      })
    ).toBe('');
    expect(headCssToExport({ data: undefined, headCss: CSS })).toBe('');
  });

  // The builder's block writes its own styles inline: on its own, it does not
  // keep the head CSS exported.
  test('is nothing with a block builder block only', () => {
    expect(
      headCssToExport({
        data: {
          mainBlocks: {
            blocks: [{ type: 'blockBuilderBlock', builderHtml: '<p>x</p>' }],
          },
        },
        headCss: CSS,
      })
    ).toBe('');
  });

  test('is nothing when no CSS is stored', () => {
    expect(
      headCssToExport({
        data: { mainBlocks: { blocks: [block] } },
        headCss: undefined,
      })
    ).toBe('');
  });
});

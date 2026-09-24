'use strict';

// The rule that needs pinning is the one about turning the flag OFF after CSS
// was written: the author must keep being able to save their email, and to
// clear the CSS, without being able to write new CSS. Getting that backwards
// locks people out of their own work.

const {
  validateHeadCss,
  bringsDisallowedHeadCss,
  assertHeadCssAllowed,
  hasHeadCss,
  HEAD_CSS_MAX_LENGTH,
} = require('../../../packages/server/mailing/head-css-guard.js');

const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

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
          htmlBlockEnabled: true,
        })
      ).toBe(false);
    });
  });

  describe('with the flag off', () => {
    const off = { htmlBlockEnabled: false };

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
  test('throws HTML_CODE_BLOCK_DISABLED on disallowed CSS', () => {
    expect(() =>
      assertHeadCssAllowed({
        css: '.a{color:red}',
        previousCss: '',
        htmlBlockEnabled: false,
      })
    ).toThrow(ERROR_CODES.HTML_CODE_BLOCK_DISABLED);
  });

  test('stays silent when the CSS is allowed', () => {
    expect(() =>
      assertHeadCssAllowed({
        css: '.a{color:red}',
        previousCss: '',
        htmlBlockEnabled: true,
      })
    ).not.toThrow();
  });
});

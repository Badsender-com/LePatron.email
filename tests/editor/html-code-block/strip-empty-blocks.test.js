'use strict';

const {
  stripEmptyHtmlCodeBlocks,
} = require('../../../packages/editor/src/js/ext/html-code-block/strip-empty-blocks.js');

const page = (body) => `<html><body>${body}</body></html>`;

describe('stripEmptyHtmlCodeBlocks', () => {
  describe('removes an empty block root', () => {
    it('with class then id, the order the browser serializes', () => {
      const html = page(
        '<div class="lp-html-block-root" id="ko_htmlCodeBlock_3"></div>'
      );
      expect(stripEmptyHtmlCodeBlocks(html)).toBe(page(''));
    });

    it('with the attributes the other way round', () => {
      const html = page(
        '<div id="ko_htmlCodeBlock_3" class="lp-html-block-root"></div>'
      );
      expect(stripEmptyHtmlCodeBlocks(html)).toBe(page(''));
    });

    it('with no id at all', () => {
      expect(
        stripEmptyHtmlCodeBlocks(page('<div class="lp-html-block-root"></div>'))
      ).toBe(page(''));
    });

    it('when whitespace was left inside', () => {
      expect(
        stripEmptyHtmlCodeBlocks(
          page('<div class="lp-html-block-root">\n  </div>')
        )
      ).toBe(page(''));
    });

    it('several of them at once', () => {
      const html = page(
        '<div class="lp-html-block-root" id="a"></div>' +
          '<p>keep</p>' +
          '<div class="lp-html-block-root" id="b"></div>'
      );
      expect(stripEmptyHtmlCodeBlocks(html)).toBe(page('<p>keep</p>'));
    });

    it('alongside other classes on the root', () => {
      expect(
        stripEmptyHtmlCodeBlocks(
          page('<div class="something lp-html-block-root other"></div>')
        )
      ).toBe(page(''));
    });
  });

  describe('never touches a block that has markup', () => {
    it('leaves a filled root completely alone', () => {
      const filled = page(
        '<div class="lp-html-block-root" id="ko_htmlCodeBlock_3">' +
          '<div class="lp-html-block"><table align="center"><tr><td>Hi</td></tr></table></div>' +
          '</div>'
      );
      expect(stripEmptyHtmlCodeBlocks(filled)).toBe(filled);
    });

    it('keeps a filled root and drops an empty sibling', () => {
      const html = page(
        '<div class="lp-html-block-root" id="a"><div class="lp-html-block">x</div></div>' +
          '<div class="lp-html-block-root" id="b"></div>'
      );
      expect(stripEmptyHtmlCodeBlocks(html)).toBe(
        page(
          '<div class="lp-html-block-root" id="a"><div class="lp-html-block">x</div></div>'
        )
      );
    });

    // ESP tags are the whole point of the feature: a block holding only a tag is
    // not empty.
    it('keeps a root holding nothing but an ESP tag', () => {
      const html = page(
        '<div class="lp-html-block-root"><div class="lp-html-block">{{firstname}}</div></div>'
      );
      expect(stripEmptyHtmlCodeBlocks(html)).toBe(html);
    });

    it('keeps a root holding only a conditional comment', () => {
      const html = page(
        '<div class="lp-html-block-root"><!--[if mso]><td>x</td><![endif]--></div>'
      );
      expect(stripEmptyHtmlCodeBlocks(html)).toBe(html);
    });
  });

  describe('is inert for everything else', () => {
    // The guarantee that a mail with no HTML code block exports the same bytes.
    it('leaves a mail without any HTML code block byte-identical', () => {
      const html = page(
        '<table class="vb-outer" width="100%" id="ko_textBlock_1">' +
          '<tr><td align="center" valign="top">Hello</td></tr></table>' +
          '<div></div><div id="other"></div><div class="lp-html-block"></div>'
      );
      expect(stripEmptyHtmlCodeBlocks(html)).toBe(html);
    });

    it('does not match a bare empty div', () => {
      expect(stripEmptyHtmlCodeBlocks(page('<div></div>'))).toBe(
        page('<div></div>')
      );
    });

    // Guards against a loose `class=` match: the inner marker class shares a
    // prefix with the root class.
    it('does not match the inner marker class on its own', () => {
      const html = page('<div class="lp-html-block"></div>');
      expect(stripEmptyHtmlCodeBlocks(html)).toBe(html);
    });

    it('does not match a class that merely contains the name', () => {
      const html = page('<div class="not-lp-html-block-root-either"></div>');
      expect(stripEmptyHtmlCodeBlocks(html)).toBe(html);
    });

    it('passes through empty and non-string input', () => {
      expect(stripEmptyHtmlCodeBlocks('')).toBe('');
      expect(stripEmptyHtmlCodeBlocks(null)).toBeNull();
      expect(stripEmptyHtmlCodeBlocks(undefined)).toBeUndefined();
    });
  });
});

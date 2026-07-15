'use strict';

const {
  listBlockNames,
  getBlockFieldPaths,
  parseTemplateBlocks,
} = require('../../../packages/server/template/template-block-parser');

describe('Template Block Parser', () => {
  describe('listBlockNames', () => {
    it('should return an empty array when markup is null, undefined or empty', () => {
      expect(listBlockNames(null)).toEqual([]);
      expect(listBlockNames(undefined)).toEqual([]);
      expect(listBlockNames('')).toEqual([]);
    });

    it('should list distinct block names', () => {
      const markup = `
        <div data-ko-block="articlesBlock"></div>
        <div data-ko-block="footerBlock"></div>
        <div data-ko-block="articlesBlock"></div>
      `;
      expect(listBlockNames(markup)).toEqual(['articlesBlock', 'footerBlock']);
    });
  });

  describe('getBlockFieldPaths', () => {
    it('should return an empty array when markup or blockName is missing', () => {
      const markup =
        '<div data-ko-block="articlesBlock"><span data-ko-editable="titleText"></span></div>';
      expect(getBlockFieldPaths(null, 'articlesBlock')).toEqual([]);
      expect(getBlockFieldPaths(markup, '')).toEqual([]);
    });

    it('should collect data-ko-editable and data-ko-link fields scoped to the given block', () => {
      const markup = `
        <div data-ko-block="articlesBlock">
          <span data-ko-editable="titleText"></span>
          <a data-ko-link="button.url"><span data-ko-editable="button.text"></span></a>
        </div>
        <div data-ko-block="footerBlock">
          <span data-ko-editable="footerText"></span>
        </div>
      `;
      expect(getBlockFieldPaths(markup, 'articlesBlock').sort()).toEqual(
        ['button.text', 'button.url', 'titleText'].sort()
      );
      expect(getBlockFieldPaths(markup, 'footerBlock')).toEqual(['footerText']);
    });

    it('should collect href/alt/src fields bound via the -ko-attr-* style pseudo-property', () => {
      // Real-world shape (see the Clarins "columns_v2Block"): the link URL and
      // the image alt text aren't declared via data-ko-link/data-ko-editable —
      // they're embedded in the style attribute using Mosaico's LESS-based
      // authoring syntax.
      const markup = `
        <div data-ko-block="columns_v2Block">
          <a style="text-decoration:none; -ko-attr-href: @[(columns1_Options.url)]" href="#toreplace">
            <img style="border: 0; -ko-attr-alt: @[(columns1_Options.alt)]" data-ko-editable="columns1_Options.src" />
          </a>
        </div>
      `;
      expect(getBlockFieldPaths(markup, 'columns_v2Block').sort()).toEqual(
        [
          'columns1_Options.url',
          'columns1_Options.alt',
          'columns1_Options.src',
        ].sort()
      );
    });

    it('should ignore -ko-attr-* bindings for layout/style attributes and non-property expressions', () => {
      const markup = `
        <div data-ko-block="columns_v2Block">
          <td style="width: 300px; -ko-width: @[(columnNumber eq 1 ? '320px' : '300px')]; -ko-padding-left: @[(gutterVisible ? '0px' : '10px')]" data-ko-display="columnNumber >= 1">
            <img style="-ko-attr-src: 'https://example.com/static.jpg'; -ko-attr-class: @[(viewChoice eq 'mobile' ? 'visible' : '')]" />
          </td>
        </div>
      `;
      expect(getBlockFieldPaths(markup, 'columns_v2Block')).toEqual([]);
    });

    it('should not leak fields from a different block', () => {
      const markup = `
        <div data-ko-block="columns_v2Block">
          <a style="-ko-attr-href: @[(columns1_Options.url)]" href="#"></a>
        </div>
        <div data-ko-block="otherBlock">
          <a style="-ko-attr-href: @[(other_Options.url)]" href="#"></a>
        </div>
      `;
      expect(getBlockFieldPaths(markup, 'columns_v2Block')).toEqual([
        'columns1_Options.url',
      ]);
    });

    it('should return an empty array for an unknown block name', () => {
      const markup =
        '<div data-ko-block="articlesBlock"><span data-ko-editable="titleText"></span></div>';
      expect(getBlockFieldPaths(markup, 'nope')).toEqual([]);
    });
  });

  describe('parseTemplateBlocks', () => {
    it('should return empty structures when markup is missing', () => {
      expect(parseTemplateBlocks(null)).toEqual({
        blockNames: [],
        fieldsByBlock: {},
      });
      expect(parseTemplateBlocks('')).toEqual({
        blockNames: [],
        fieldsByBlock: {},
      });
    });

    it('should return every block and its fields in a single parse', () => {
      const markup = `
        <div data-ko-block="articlesBlock">
          <span data-ko-editable="titleText"></span>
          <a data-ko-link="button.url"></a>
          <img style="-ko-attr-alt: @[(image.alt)]" data-ko-editable="image.src" />
        </div>
        <div data-ko-block="footerBlock">
          <span data-ko-editable="footerText"></span>
        </div>
        <div data-ko-block="emptyBlock"></div>
      `;
      const { blockNames, fieldsByBlock } = parseTemplateBlocks(markup);
      expect(blockNames.sort()).toEqual(
        ['articlesBlock', 'footerBlock', 'emptyBlock'].sort()
      );
      expect(fieldsByBlock.articlesBlock.sort()).toEqual(
        ['titleText', 'button.url', 'image.alt', 'image.src'].sort()
      );
      expect(fieldsByBlock.footerBlock).toEqual(['footerText']);
      // A block with no mappable field is still listed, with an empty field set.
      expect(fieldsByBlock.emptyBlock).toEqual([]);
    });

    it('should return a cached (identical) result for the same markup', () => {
      const markup =
        '<div data-ko-block="articlesBlock"><span data-ko-editable="titleText"></span></div>';
      const first = parseTemplateBlocks(markup);
      const second = parseTemplateBlocks(markup);
      // Memoized: same object reference is returned on repeated calls.
      expect(second).toBe(first);
    });

    it('should re-parse when the markup content changes', () => {
      const markupA =
        '<div data-ko-block="a"><span data-ko-editable="x"></span></div>';
      const markupB =
        '<div data-ko-block="b"><span data-ko-editable="y"></span></div>';
      expect(parseTemplateBlocks(markupA).blockNames).toEqual(['a']);
      expect(parseTemplateBlocks(markupB).blockNames).toEqual(['b']);
    });

    // The DOM-free scanner must not mistake markup-like characters inside a
    // <style>/<script> body for real tags — templates embed a large
    // `@supports -ko-blockdefs { ... }` block there, full of `{`, `:` and `>`.
    it('should ignore field-like tokens inside <style> and <script> bodies', () => {
      const markup = `
        <html>
          <head><style>@supports -ko-blockdefs { foo { a > b; } }</style></head>
          <body>
            <div data-ko-block="realBlock">
              <span data-ko-editable="real.title"></span>
            </div>
          </body>
        </html>
      `;
      const { blockNames, fieldsByBlock } = parseTemplateBlocks(markup);
      expect(blockNames).toEqual(['realBlock']);
      expect(fieldsByBlock.realBlock).toEqual(['real.title']);
    });

    it('should attribute a field to its nearest enclosing block when blocks nest', () => {
      const markup = `
        <div data-ko-block="outerBlock">
          <span data-ko-editable="outer.title"></span>
          <div data-ko-block="innerBlock">
            <span data-ko-editable="inner.title"></span>
          </div>
          <span data-ko-editable="outer.footer"></span>
        </div>
      `;
      const { fieldsByBlock } = parseTemplateBlocks(markup);
      expect(fieldsByBlock.outerBlock.sort()).toEqual(
        ['outer.title', 'outer.footer'].sort()
      );
      expect(fieldsByBlock.innerBlock).toEqual(['inner.title']);
    });

    it('should handle void/self-closed elements without corrupting block scope', () => {
      const markup = `
        <div data-ko-block="imgBlock">
          <img data-ko-editable="img.src" style="-ko-attr-alt: @[(img.alt)]" />
          <br>
          <span data-ko-editable="img.caption"></span>
        </div>
        <div data-ko-block="afterBlock">
          <span data-ko-editable="after.text"></span>
        </div>
      `;
      const { fieldsByBlock } = parseTemplateBlocks(markup);
      expect(fieldsByBlock.imgBlock.sort()).toEqual(
        ['img.src', 'img.alt', 'img.caption'].sort()
      );
      // A stray <br> or a self-closed <img> must not leak imgBlock's scope into
      // the sibling block.
      expect(fieldsByBlock.afterBlock).toEqual(['after.text']);
    });
  });
});

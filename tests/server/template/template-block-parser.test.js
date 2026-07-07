'use strict';

const {
  listBlockNames,
  getBlockFieldPaths,
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
      const markup = '<div data-ko-block="articlesBlock"><span data-ko-editable="titleText"></span></div>';
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
  });
});

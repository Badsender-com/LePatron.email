'use strict';

const {
  parseProtectionConfig,
  isFieldProtected,
} = require('./template-protection-parser');

describe('Template Protection Parser', () => {
  describe('parseProtectionConfig', () => {
    it('should return empty config when markup is null or undefined', () => {
      expect(parseProtectionConfig(null)).toEqual({
        _protectedBlocks: [],
        _protectedFields: {},
      });
      expect(parseProtectionConfig(undefined)).toEqual({
        _protectedBlocks: [],
        _protectedFields: {},
      });
      expect(parseProtectionConfig('')).toEqual({
        _protectedBlocks: [],
        _protectedFields: {},
      });
    });

    it('should return empty config when no data-translate attributes exist', () => {
      const markup = `
        <div data-ko-block="contentBlock">
          <h1 data-ko-editable="titleText">@[titleText]</h1>
          <p data-ko-editable="bodyText">@[bodyText]</p>
        </div>
      `;
      const config = parseProtectionConfig(markup);
      expect(config._protectedBlocks).toEqual([]);
      expect(config._protectedFields).toEqual({});
    });

    it('should protect a single field with data-translate="false"', () => {
      const markup = `
        <div data-ko-block="contentBlock">
          <h1 data-ko-editable="titleText">@[titleText]</h1>
          <p data-ko-editable="legalDisclaimer" data-translate="false">
            @[legalDisclaimer]
          </p>
        </div>
      `;
      const config = parseProtectionConfig(markup);
      expect(config._protectedBlocks).toEqual([]);
      expect(config._protectedFields).toEqual({
        'contentBlock.legalDisclaimer': false,
      });
    });

    it('should protect entire block with data-translate="false"', () => {
      const markup = `
        <div data-ko-block="footerBlock" data-translate="false">
          <p data-ko-editable="legalText">@[legalText]</p>
          <p data-ko-editable="unsubText">@[unsubText]</p>
        </div>
      `;
      const config = parseProtectionConfig(markup);
      expect(config._protectedBlocks).toEqual(['footerBlock']);
      // Fields inside protected block don't need to be listed
      expect(config._protectedFields).toEqual({});
    });

    it('should allow exception with data-translate="true" inside protected block', () => {
      const markup = `
        <div data-ko-block="footerBlock" data-translate="false">
          <p data-ko-editable="legalText">@[legalText]</p>
          <p data-ko-editable="customMessage" data-translate="true">
            @[customMessage]
          </p>
          <p data-ko-editable="unsubText">@[unsubText]</p>
        </div>
      `;
      const config = parseProtectionConfig(markup);
      expect(config._protectedBlocks).toEqual(['footerBlock']);
      // customMessage is an exception (translatable) inside protected block
      expect(config._protectedFields).toEqual({
        'footerBlock.customMessage': true,
      });
    });

    it('should handle nested containers with inheritance', () => {
      const markup = `
        <div data-ko-block="complexBlock" data-translate="false">
          <div class="header">
            <p data-ko-editable="headerText">@[headerText]</p>
          </div>
          <div class="content" data-translate="true">
            <h2 data-ko-editable="contentTitle">@[contentTitle]</h2>
            <p data-ko-editable="contentBody">@[contentBody]</p>
          </div>
          <div class="footer">
            <p data-ko-editable="footerText">@[footerText]</p>
          </div>
        </div>
      `;
      const config = parseProtectionConfig(markup);
      expect(config._protectedBlocks).toEqual(['complexBlock']);
      // contentTitle and contentBody have data-translate="true" override
      expect(config._protectedFields).toEqual({
        'complexBlock.contentTitle': true,
        'complexBlock.contentBody': true,
      });
    });

    it('should handle multiple blocks with different protection', () => {
      const markup = `
        <div data-ko-block="headerBlock">
          <h1 data-ko-editable="titleText">@[titleText]</h1>
        </div>
        <div data-ko-block="legalBlock" data-translate="false">
          <p data-ko-editable="legalText">@[legalText]</p>
        </div>
        <div data-ko-block="contentBlock">
          <p data-ko-editable="bodyText">@[bodyText]</p>
          <small data-ko-editable="disclaimer" data-translate="false">
            @[disclaimer]
          </small>
        </div>
      `;
      const config = parseProtectionConfig(markup);
      expect(config._protectedBlocks).toEqual(['legalBlock']);
      expect(config._protectedFields).toEqual({
        'contentBlock.disclaimer': false,
      });
    });

    it('should handle same field name in different blocks', () => {
      const markup = `
        <div data-ko-block="headerBlock">
          <p data-ko-editable="titleText">@[titleText]</p>
        </div>
        <div data-ko-block="footerBlock" data-translate="false">
          <p data-ko-editable="titleText">@[titleText]</p>
        </div>
        <div data-ko-block="contentBlock">
          <p data-ko-editable="titleText">@[titleText]</p>
        </div>
      `;
      const config = parseProtectionConfig(markup);
      // Only footerBlock is protected
      expect(config._protectedBlocks).toEqual(['footerBlock']);
      // titleText in headerBlock and contentBlock should NOT be protected
    });
  });

  describe('isFieldProtected', () => {
    it('should return false when protectionConfig is null', () => {
      expect(isFieldProtected('data.block.field', 'field', null)).toBe(false);
    });

    it('should return false when field is in non-protected block', () => {
      const config = {
        _protectedBlocks: ['footerBlock'],
        _protectedFields: {},
      };
      expect(
        isFieldProtected('data.headerBlock.titleText', 'titleText', config)
      ).toBe(false);
    });

    it('should return true when field is in protected block', () => {
      const config = {
        _protectedBlocks: ['footerBlock'],
        _protectedFields: {},
      };
      expect(
        isFieldProtected('data.footerBlock.legalText', 'legalText', config)
      ).toBe(true);
    });

    it('should return false for exception inside protected block', () => {
      const config = {
        _protectedBlocks: ['footerBlock'],
        _protectedFields: { 'footerBlock.customMessage': true },
      };
      expect(
        isFieldProtected(
          'data.footerBlock.customMessage',
          'customMessage',
          config
        )
      ).toBe(false);
    });

    it('should return true for field-level protection in non-protected block', () => {
      const config = {
        _protectedBlocks: [],
        _protectedFields: { 'contentBlock.disclaimer': false },
      };
      expect(
        isFieldProtected('data.contentBlock.disclaimer', 'disclaimer', config)
      ).toBe(true);
    });

    it('should handle nested paths correctly', () => {
      const config = {
        _protectedBlocks: ['footerBlock'],
        _protectedFields: {},
      };
      // Path with nested structure containing footerBlock
      expect(
        isFieldProtected(
          'data.mainBlocks.blocks.0.footerBlock.legalText',
          'legalText',
          config
        )
      ).toBe(true);
    });

    it('should handle same field in different blocks correctly', () => {
      const config = {
        _protectedBlocks: ['footerBlock'],
        _protectedFields: {},
      };
      // Same field name, different blocks
      expect(
        isFieldProtected('data.footerBlock.titleText', 'titleText', config)
      ).toBe(true);
      expect(
        isFieldProtected('data.headerBlock.titleText', 'titleText', config)
      ).toBe(false);
      expect(
        isFieldProtected('data.contentBlock.titleText', 'titleText', config)
      ).toBe(false);
    });

    it('should return false for empty path or fieldName', () => {
      const config = {
        _protectedBlocks: ['footerBlock'],
        _protectedFields: {},
      };
      expect(isFieldProtected('', 'field', config)).toBe(false);
      expect(isFieldProtected('data.block.field', '', config)).toBe(false);
      expect(isFieldProtected('data.block.field', null, config)).toBe(false);
    });
  });
});

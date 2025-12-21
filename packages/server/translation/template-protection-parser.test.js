'use strict';

const {
  parseProtectionConfig,
  isFieldProtected,
} = require('./template-protection-parser');

describe('Template Protection Parser', () => {
  describe('parseProtectionConfig', () => {
    it('should return empty object when markup is null or undefined', () => {
      expect(parseProtectionConfig(null)).toEqual({});
      expect(parseProtectionConfig(undefined)).toEqual({});
      expect(parseProtectionConfig('')).toEqual({});
    });

    it('should return empty object when no data-translate attributes exist', () => {
      const markup = `
        <div data-ko-block="contentBlock">
          <h1 data-ko-editable="titleText">@[titleText]</h1>
          <p data-ko-editable="bodyText">@[bodyText]</p>
        </div>
      `;
      expect(parseProtectionConfig(markup)).toEqual({});
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
      expect(config).toEqual({ legalDisclaimer: false });
    });

    it('should protect entire block and all its descendants', () => {
      const markup = `
        <div data-ko-block="footerBlock" data-translate="false">
          <p data-ko-editable="legalText">@[legalText]</p>
          <p data-ko-editable="unsubText">@[unsubText]</p>
        </div>
      `;
      const config = parseProtectionConfig(markup);
      expect(config).toEqual({
        legalText: false,
        unsubText: false,
      });
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
      // customMessage should NOT be in the config (it's translatable)
      expect(config).toEqual({
        legalText: false,
        unsubText: false,
      });
      expect(config.customMessage).toBeUndefined();
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
      // headerText and footerText inherit false from block
      // contentTitle and contentBody inherit true from content div
      expect(config).toEqual({
        headerText: false,
        footerText: false,
      });
      expect(config.contentTitle).toBeUndefined();
      expect(config.contentBody).toBeUndefined();
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
      expect(config).toEqual({
        legalText: false,
        disclaimer: false,
      });
    });

    it('should ignore elements without data-ko-editable', () => {
      const markup = `
        <div data-ko-block="block" data-translate="false">
          <p>Static text not editable</p>
          <p data-ko-editable="editableText">@[editableText]</p>
        </div>
      `;
      const config = parseProtectionConfig(markup);
      expect(config).toEqual({ editableText: false });
    });

    it('should handle deeply nested structures', () => {
      const markup = `
        <div data-ko-block="outerBlock">
          <div class="level1">
            <div class="level2" data-translate="false">
              <div class="level3">
                <p data-ko-editable="deepField">@[deepField]</p>
              </div>
            </div>
          </div>
        </div>
      `;
      const config = parseProtectionConfig(markup);
      expect(config).toEqual({ deepField: false });
    });
  });

  describe('isFieldProtected', () => {
    it('should return false when protectionConfig is null', () => {
      expect(isFieldProtected('anyField', null)).toBe(false);
    });

    it('should return false when field is not in config', () => {
      const config = { protectedField: false };
      expect(isFieldProtected('unprotectedField', config)).toBe(false);
    });

    it('should return true when field is protected', () => {
      const config = { protectedField: false };
      expect(isFieldProtected('protectedField', config)).toBe(true);
    });

    it('should return false for empty fieldName', () => {
      const config = { protectedField: false };
      expect(isFieldProtected('', config)).toBe(false);
      expect(isFieldProtected(null, config)).toBe(false);
    });
  });
});

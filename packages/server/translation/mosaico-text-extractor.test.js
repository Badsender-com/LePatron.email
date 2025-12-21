'use strict';

const {
  extractTexts,
  getExtractionStats,
  isTranslatableFieldName,
  isTranslatableValue,
} = require('./mosaico-text-extractor');

describe('MosaicoTextExtractor', () => {
  describe('isTranslatableFieldName', () => {
    it('should return true for text fields', () => {
      expect(isTranslatableFieldName('text')).toBe(true);
      expect(isTranslatableFieldName('buttonText')).toBe(true);
      expect(isTranslatableFieldName('titleText')).toBe(true);
      expect(isTranslatableFieldName('preheaderText')).toBe(true);
    });

    it('should return true for alt fields', () => {
      expect(isTranslatableFieldName('imageAlt')).toBe(true);
      expect(isTranslatableFieldName('altText')).toBe(true);
    });

    it('should return true for title and label fields', () => {
      expect(isTranslatableFieldName('sectionTitle')).toBe(true);
      expect(isTranslatableFieldName('buttonLabel')).toBe(true);
    });

    it('should return false for color fields', () => {
      expect(isTranslatableFieldName('backgroundColor')).toBe(false);
      expect(isTranslatableFieldName('textColor')).toBe(false);
      expect(isTranslatableFieldName('borderColor')).toBe(false);
    });

    it('should return false for URL fields', () => {
      expect(isTranslatableFieldName('href')).toBe(false);
      expect(isTranslatableFieldName('buttonLink')).toBe(false);
      expect(isTranslatableFieldName('imageLink')).toBe(false);
      expect(isTranslatableFieldName('image')).toBe(false);
    });

    it('should return false for style fields', () => {
      expect(isTranslatableFieldName('textStyle')).toBe(false);
      expect(isTranslatableFieldName('titleTextStyle')).toBe(false);
    });
  });

  describe('isTranslatableValue', () => {
    it('should return true for regular text', () => {
      expect(isTranslatableValue('Hello world')).toBe(true);
      expect(isTranslatableValue('Découvrez nos nouveautés')).toBe(true);
    });

    it('should return true for HTML content', () => {
      expect(isTranslatableValue('<p>Hello <strong>world</strong></p>')).toBe(
        true
      );
    });

    it('should return true for text with dynamic variables', () => {
      expect(isTranslatableValue('Bonjour %%PRENOM%%')).toBe(true);
      expect(isTranslatableValue('Hello {{user.name}}')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(isTranslatableValue('')).toBe(false);
      expect(isTranslatableValue('   ')).toBe(false);
    });

    it('should return false for URLs', () => {
      expect(isTranslatableValue('https://example.com')).toBe(false);
      expect(isTranslatableValue('http://test.com/page')).toBe(false);
      expect(isTranslatableValue('mailto:test@example.com')).toBe(false);
    });

    it('should return false for email addresses', () => {
      expect(isTranslatableValue('test@example.com')).toBe(false);
    });

    it('should return false for color values', () => {
      expect(isTranslatableValue('#ff0000')).toBe(false);
      expect(isTranslatableValue('#FFF')).toBe(false);
      expect(isTranslatableValue('rgb(255, 0, 0)')).toBe(false);
      expect(isTranslatableValue('transparent')).toBe(false);
    });

    it('should return false for pure Mosaico variables', () => {
      expect(isTranslatableValue('@[backgroundColor]')).toBe(false);
      expect(isTranslatableValue('@[theme.color]')).toBe(false);
    });

    it('should return false for numeric values', () => {
      expect(isTranslatableValue('14px')).toBe(false);
      expect(isTranslatableValue('100%')).toBe(false);
      expect(isTranslatableValue('1.5em')).toBe(false);
    });
  });

  describe('extractTexts', () => {
    it('should extract email name', () => {
      const mailing = {
        name: 'My Newsletter',
        data: {},
      };

      const result = extractTexts(mailing);

      expect(result._name).toBe('My Newsletter');
    });

    it('should extract text fields from data', () => {
      const mailing = {
        name: 'Test Email',
        data: {
          preheaderBlock: {
            preheaderText: 'Preview text here',
            backgroundColor: '#ffffff',
          },
          titleBlock: {
            titleText: 'Welcome to our newsletter',
          },
        },
      };

      const result = extractTexts(mailing);

      expect(result._name).toBe('Test Email');
      expect(result['data.preheaderBlock.preheaderText']).toBe(
        'Preview text here'
      );
      expect(result['data.titleBlock.titleText']).toBe(
        'Welcome to our newsletter'
      );
      expect(result['data.preheaderBlock.backgroundColor']).toBeUndefined();
    });

    it('should extract button text', () => {
      const mailing = {
        name: 'CTA Test',
        data: {
          buttonBlock: {
            buttonText: 'Click here',
            buttonLink: 'https://example.com',
          },
        },
      };

      const result = extractTexts(mailing);

      expect(result['data.buttonBlock.buttonText']).toBe('Click here');
      expect(result['data.buttonBlock.buttonLink']).toBeUndefined();
    });

    it('should extract image alt text', () => {
      const mailing = {
        name: 'Image Test',
        data: {
          imageBlock: {
            image: 'https://cdn.example.com/image.jpg',
            imageAlt: 'Product photo',
            imageLink: 'https://example.com',
          },
        },
      };

      const result = extractTexts(mailing);

      expect(result['data.imageBlock.imageAlt']).toBe('Product photo');
      expect(result['data.imageBlock.image']).toBeUndefined();
    });

    it('should skip style objects', () => {
      const mailing = {
        name: 'Style Test',
        data: {
          textBlock: {
            text: 'Hello world',
            textStyle: {
              color: '#000000',
              size: 14,
            },
          },
        },
      };

      const result = extractTexts(mailing);

      expect(result['data.textBlock.text']).toBe('Hello world');
      expect(result['data.textBlock.textStyle.color']).toBeUndefined();
    });

    it('should handle nested structures', () => {
      const mailing = {
        name: 'Nested Test',
        data: {
          content: {
            mainBlocks: {
              blocks: [
                { blockName: 'header', titleText: 'Header Title' },
                { blockName: 'body', text: 'Body content' },
              ],
            },
          },
        },
      };

      const result = extractTexts(mailing);

      expect(result['data.content.mainBlocks.blocks.0.titleText']).toBe(
        'Header Title'
      );
      expect(result['data.content.mainBlocks.blocks.1.text']).toBe(
        'Body content'
      );
    });

    it('should preserve HTML in text fields', () => {
      const mailing = {
        name: 'HTML Test',
        data: {
          textBlock: {
            text: '<p>Hello <strong>world</strong></p>',
          },
        },
      };

      const result = extractTexts(mailing);

      expect(result['data.textBlock.text']).toBe(
        '<p>Hello <strong>world</strong></p>'
      );
    });

    it('should return empty object for empty mailing', () => {
      const mailing = {
        name: '',
        data: {},
      };

      const result = extractTexts(mailing);

      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('getExtractionStats', () => {
    it('should return correct statistics', () => {
      const texts = {
        _name: 'Test Email',
        'data.block.text': 'Hello world',
        'data.block.buttonText': 'Click',
      };

      const stats = getExtractionStats(texts);

      expect(stats.fieldCount).toBe(3);
      expect(stats.totalCharacters).toBe(26); // 10 + 11 + 5
      expect(stats.fields).toContain('_name');
      expect(stats.fields).toContain('data.block.text');
    });

    it('should handle empty texts', () => {
      const stats = getExtractionStats({});

      expect(stats.fieldCount).toBe(0);
      expect(stats.totalCharacters).toBe(0);
    });
  });

  describe('extractTexts with protectionConfig', () => {
    it('should work without protection config (backward compatible)', () => {
      const mailing = {
        name: 'Test Email',
        data: {
          block: {
            titleText: 'Hello',
            bodyText: 'World',
          },
        },
      };

      const result = extractTexts(mailing);

      expect(result._name).toBe('Test Email');
      expect(result['data.block.titleText']).toBe('Hello');
      expect(result['data.block.bodyText']).toBe('World');
    });

    it('should exclude protected fields', () => {
      const mailing = {
        name: 'Test Email',
        data: {
          block: {
            titleText: 'Hello',
            legalText: 'Do not translate',
            bodyText: 'World',
          },
        },
      };

      const protectionConfig = {
        legalText: false,
      };

      const result = extractTexts(mailing, protectionConfig);

      expect(result._name).toBe('Test Email');
      expect(result['data.block.titleText']).toBe('Hello');
      expect(result['data.block.bodyText']).toBe('World');
      expect(result['data.block.legalText']).toBeUndefined();
    });

    it('should exclude multiple protected fields', () => {
      const mailing = {
        name: 'Test Email',
        data: {
          headerBlock: {
            titleText: 'Welcome',
            companyName: 'ACME Corp',
          },
          footerBlock: {
            legalText: 'Legal disclaimer',
            copyrightText: '© 2024',
          },
        },
      };

      const protectionConfig = {
        companyName: false,
        legalText: false,
        copyrightText: false,
      };

      const result = extractTexts(mailing, protectionConfig);

      expect(result['data.headerBlock.titleText']).toBe('Welcome');
      expect(result['data.headerBlock.companyName']).toBeUndefined();
      expect(result['data.footerBlock.legalText']).toBeUndefined();
      expect(result['data.footerBlock.copyrightText']).toBeUndefined();
    });

    it('should handle nested blocks with protected fields', () => {
      const mailing = {
        name: 'Nested Test',
        data: {
          content: {
            blocks: [
              { titleText: 'Title 1', brandName: 'ACME' },
              { titleText: 'Title 2', brandName: 'ACME' },
            ],
          },
        },
      };

      const protectionConfig = {
        brandName: false,
      };

      const result = extractTexts(mailing, protectionConfig);

      expect(result['data.content.blocks.0.titleText']).toBe('Title 1');
      expect(result['data.content.blocks.1.titleText']).toBe('Title 2');
      expect(result['data.content.blocks.0.brandName']).toBeUndefined();
      expect(result['data.content.blocks.1.brandName']).toBeUndefined();
    });

    it('should not affect email name (never protected)', () => {
      const mailing = {
        name: 'Newsletter Name',
        data: {
          block: {
            titleText: 'Hello',
          },
        },
      };

      // Even if someone tries to protect _name, it should still be extracted
      const protectionConfig = {
        _name: false,
      };

      const result = extractTexts(mailing, protectionConfig);

      expect(result._name).toBe('Newsletter Name');
    });

    it('should handle empty protection config', () => {
      const mailing = {
        name: 'Test',
        data: {
          block: {
            titleText: 'Hello',
          },
        },
      };

      const result = extractTexts(mailing, {});

      expect(result._name).toBe('Test');
      expect(result['data.block.titleText']).toBe('Hello');
    });
  });
});

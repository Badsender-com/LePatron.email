'use strict';

const {
  isHeaderOrFooterBlock,
} = require('../../../packages/shared/quality/header-footer-blocks.js');

describe('isHeaderOrFooterBlock', () => {
  it.each([
    'headerBlock',
    'headerBlockV2',
    'preheaderBlock',
    'footerBlock',
    'footer-legal',
    'footerSocialBlock',
    'sectionHeader',
  ])('reads %s as the frame of the email', (type) => {
    expect(isHeaderOrFooterBlock(type)).toBe(true);
  });

  it.each(['HeaderAndText', 'legalBlock', 'coverBlock', '', undefined])(
    'reads %s as content',
    (type) => {
      expect(isHeaderOrFooterBlock(type)).toBe(false);
    }
  );
});

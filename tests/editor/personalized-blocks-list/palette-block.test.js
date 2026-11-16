'use strict';

const {
  toPaletteBlock,
} = require('../../../packages/editor/src/js/vue/components/personalized-blocks-list/palette-block.js');

const entry = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Footer',
  category: 'Legal',
  content: { type: 'footerBlock', text: 'Unsubscribe' },
  _group: '507f1f77bcf86cd799439001',
  _template: '507f1f77bcf86cd799439002',
  _user: '507f1f77bcf86cd799439003',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  userDetails: {
    name: 'Camille',
    email: 'camille@example.com',
    role: 'company_admin',
    createdAt: '2026-01-01T10:00:00.000Z',
  },
  ...overrides,
});

describe('a saved block, in the palette', () => {
  it('keeps the id, the name, the category and the author name only', () => {
    const { blockInformation } = toPaletteBlock(entry());

    expect(blockInformation).toEqual({
      _id: '507f1f77bcf86cd799439011',
      name: 'Footer',
      category: 'Legal',
      userDetails: { name: 'Camille' },
    });
  });

  it('is the saved content, with an id the email gives it once added', () => {
    const block = toPaletteBlock(entry());

    expect(block.type).toBe('footerBlock');
    expect(block.text).toBe('Unsubscribe');
    expect(block.id).toBe('');
    expect(block).not.toHaveProperty('content');
    expect(block).not.toHaveProperty('_user');
  });

  describe('its author', () => {
    it('is the stored user name', () => {
      const block = toPaletteBlock(entry());

      expect(block.blockInformation.userDetails.name).toBe('Camille');
    });

    it('is the stored name as it is, even empty', () => {
      const block = toPaletteBlock(entry({ userDetails: { name: '' } }));

      expect(block.blockInformation.userDetails.name).toBe('');
    });

    it('is empty for a stored user who has no name', () => {
      const block = toPaletteBlock(entry({ userDetails: {} }));

      expect(block.blockInformation.userDetails).toEqual({ name: '' });
    });

    it('is admin for an author who is no stored user', () => {
      const { userDetails: _author, ...withoutAuthor } = entry();
      const block = toPaletteBlock(withoutAuthor);

      expect(block.blockInformation.userDetails).toEqual({ name: 'admin' });
    });
  });
});

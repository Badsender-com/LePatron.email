/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * The text fields of a block (ext/block-text-fields.js, #1253): one listing,
 * read by the quality control (the empty blocks rule asks it whether the
 * template ships text for a block) and, later, by the AI spelling correction
 * (epic #1251). A text field is a field block translation names as text.
 */

const {
  listTextFields,
  visibleText,
} = require('../../packages/editor/src/js/ext/block-text-fields');
const VERSAFIX_BLOCKS = require('../../packages/editor/spec/data/template-versafix-1.blocks.json');

const BLOCK = {
  id: 'ko_textBlock_3',
  type: 'textBlock',
  titleText: 'Les soldes commencent',
  longText: '<p>Profitez de <strong>-30 %</strong></p>',
  buttonText: 'Je choisis',
  buttonLink: 'https://example.com',
  backgroundColor: '#ffffff',
  image: { src: 'https://example.com/a.png', alt: 'Une robe en lin' },
  items: [{ text: 'Livraison offerte' }],
};

const paths = (fields) => fields.map((field) => field.path);
const roles = (block) =>
  Object.fromEntries(
    listTextFields(block).map((field) => [field.path, field.role])
  );
const atDefault = (block, blockDef) =>
  paths(listTextFields(block, { blockDef }).filter((field) => field.atDefault));
const versafix = (type) => VERSAFIX_BLOCKS.find((block) => block.type === type);

describe('the text fields of a block', () => {
  it('lists the text fields with their paths, alternative texts and list items included', () => {
    expect(paths(listTextFields(BLOCK))).toEqual([
      'titleText',
      'longText',
      'buttonText',
      'image.alt',
      'items.0.text',
    ]);
  });

  it('leaves out colours, links and anything that is not text', () => {
    const listed = paths(listTextFields(BLOCK));
    expect(listed).not.toContain('backgroundColor');
    expect(listed).not.toContain('buttonLink');
    expect(listed).not.toContain('image.src');
  });

  describe('what translation leaves alone', () => {
    const block = {
      titleText: '@[prenom]',
      longText: 'https://example.com/promo',
      caption: 'Bonjour @[prenom]',
      heading: '12px',
      subTitle: '#fafafa',
    };

    it('is left out by default: the listing holds what translation translates', () => {
      expect(listTextFields(block)).toEqual([
        expect.objectContaining({ path: 'caption', translatable: true }),
      ]);
    });

    it('is listed on demand when a reader sees it, a lone merge tag or an address', () => {
      const fields = listTextFields(block, { untranslatable: true });
      expect(
        fields.map(({ path, translatable }) => [path, translatable])
      ).toEqual([
        ['titleText', false],
        ['longText', false],
        ['caption', true],
      ]);
    });

    it('never lists a string of a list translation leaves alone', () => {
      const listed = listTextFields(
        { items: ['https://example.com', '@[prenom]', 'Livraison offerte'] },
        { untranslatable: true }
      );
      expect(paths(listed)).toEqual(['items.2']);
    });
  });

  it('gives each field its value and its role', () => {
    expect(listTextFields(BLOCK)).toEqual([
      expect.objectContaining({
        path: 'titleText',
        role: 'title',
        value: 'Les soldes commencent',
      }),
      expect.objectContaining({ path: 'longText', role: 'text' }),
      expect.objectContaining({ path: 'buttonText', role: 'button' }),
      expect.objectContaining({
        path: 'image.alt',
        role: 'alt',
        value: 'Une robe en lin',
      }),
      expect.objectContaining({ path: 'items.0.text', role: 'text' }),
    ]);
  });

  it('reads the text of a link object as a button, as versafix lays it out', () => {
    expect(
      roles({
        buttonLink: { text: 'BUTTON', url: '' },
        leftButtonLink: { text: 'BUTTON', url: '' },
        link: { text: 'BUTTON', url: '' },
        items: [{ link: { text: 'Voir', url: '' } }],
      })
    ).toEqual({
      'buttonLink.text': 'button',
      'leftButtonLink.text': 'button',
      'link.text': 'button',
      'items.0.link.text': 'button',
    });
  });

  it('tells a button by the words of its name, not by letters inside a word', () => {
    expect(
      roles({
        ctaLabel: 'Je découvre',
        mainCTAText: 'Je découvre',
        contactAddressText: '1 rue de la Paix',
        selectableText: 'Option',
        priceLabel: '29 €',
        badgeLabel: 'Nouveau',
        label: 'Nouveau',
      })
    ).toEqual({
      ctaLabel: 'button',
      mainCTAText: 'button',
      contactAddressText: 'text',
      selectableText: 'text',
      priceLabel: 'text',
      badgeLabel: 'text',
      label: 'text',
    });
  });

  it('reads a heading as a title, an alt by the first or last word of its name', () => {
    expect(
      roles({
        heading: 'Nouveautés',
        subTitle: 'Printemps',
        titleImage: { alt: 'Logo' },
        altText: 'Logo',
        imageAlt: 'Logo',
        alternativeHeading: 'Ou bien',
        altitudeText: '1 200 m',
      })
    ).toEqual({
      heading: 'title',
      subTitle: 'title',
      'titleImage.alt': 'alt',
      altText: 'alt',
      imageAlt: 'alt',
      alternativeHeading: 'title',
      altitudeText: 'text',
    });
  });

  it('reads the text of each link of a list as a button', () => {
    expect(
      roles({ links: [{ text: 'Voir', url: '' }, { text: 'Acheter' }] })
    ).toEqual({ 'links.0.text': 'button', 'links.1.text': 'button' });
  });

  it('reads the texts of a block with a share button style as buttons, as versafix lays them out', () => {
    expect(roles(versafix('shareBlock'))).toEqual({
      fbText: 'button',
      twText: 'button',
      inText: 'button',
      ggText: 'button',
      piText: 'button',
    });
    expect(roles(versafix('tripleArticleBlock'))).toMatchObject({
      leftTitleText: 'title',
      leftLongText: 'text',
      'leftButtonLink.text': 'button',
    });
  });

  it('reads the `text` of a versafix block with a title style as a title', () => {
    expect(roles(versafix('titleBlock'))).toEqual({ text: 'title' });
    expect(roles(versafix('singleArticleBlock'))).toMatchObject({
      text: 'title',
      longText: 'text',
      'buttonLink.text': 'button',
    });
    expect(roles({ text: 'Bonjour' })).toEqual({ text: 'text' });
    expect(roles({ titleTextStyle: {}, intro: { text: 'Bonjour' } })).toEqual({
      'intro.text': 'text',
    });
  });

  describe('the visible text', () => {
    it.each([
      ['an inline tag splits no word', 'Pro<strong>mo</strong>', 'Promo'],
      ['an inline tag adds no space', 'a <a href="#">b</a>, c', 'a b, c'],
      ['a block-level break keeps words apart', '<p>a</p><p>b</p>', 'a b'],
      ['entities are decoded', '<p>Prix &amp; promo</p>', 'Prix & promo'],
      ['ordinary spaces collapse', '<p>Write\n   here </p>', 'Write here'],
      [
        'a non-breaking space stays',
        '<p>Profitez&nbsp;de</p>',
        'Profitez\u00a0de',
      ],
    ])('%s', (_label, value, text) => {
      expect(visibleText(value)).toBe(text);
    });

    it('holds no letter for a zero-width non-joiner nor an empty paragraph', () => {
      expect(visibleText('<p>&zwnj;</p>')).not.toMatch(/\p{L}/u);
      expect(visibleText('<p> </p>')).toBe('');
    });
  });

  describe('a field at the template’s default', () => {
    it('is flagged', () => {
      const blockDef = { titleText: 'Titre', buttonText: 'Je choisis' };
      expect(atDefault(BLOCK, blockDef)).toEqual(['buttonText']);
    });

    it('is flagged whatever markup and spaces the editor wrapped it in', () => {
      const blockDef = {
        longText: '<p>Write here</p>',
        buttonLink: { text: 'BUTTON' },
        caption: 'Write here',
      };
      const block = {
        longText: '<p data-mce-style="">Write\n  here</p>',
        buttonLink: { text: '<span>BUTTON</span>' },
        caption: '<p>Write\u00a0here</p>',
      };
      expect(atDefault(block, blockDef)).toEqual([
        'longText',
        'buttonLink.text',
        'caption',
      ]);
    });

    it('is read along a list path, and never for a path the definition lacks', () => {
      const blockDef = { items: [{ text: 'Livraison offerte' }] };
      const block = {
        items: [{ text: 'Livraison offerte' }, { text: 'Livraison offerte' }],
        caption: 'Livraison offerte',
      };
      expect(atDefault(block, blockDef)).toEqual(['items.0.text']);
    });

    it('is never an emptied field against an empty default', () => {
      expect(
        atDefault({ longText: '<p> </p>' }, { longText: '<p></p>' })
      ).toEqual([]);
    });
  });

  it('flags a field the rendering hides, as the caller sees it', () => {
    const hidden = listTextFields(BLOCK, {
      isHidden: (path) => path === 'longText',
    })
      .filter((field) => field.hidden)
      .map((field) => field.path);
    expect(hidden).toEqual(['longText']);
  });

  it('flags nothing without a block definition nor a rendering', () => {
    expect(
      listTextFields(BLOCK).every((field) => !field.atDefault && !field.hidden)
    ).toBe(true);
  });
});

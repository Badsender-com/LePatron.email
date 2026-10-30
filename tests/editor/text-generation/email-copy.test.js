'use strict';

/**
 * Acceptance tests of text generation (epic #1163): the text the editor sends.
 *
 * The skill reads the email as the user sees it, block after block, each piece
 * of text with its role. Seam: a pure function over the plain content of the
 * editor (`ko.toJS(viewModel.content())`), so the test needs no editor.
 */

// Turned on by #1166 (generate and apply a subject from the editor)
describe.skip('editor: extracting the email copy', () => {
  let extractEmailCopy;

  beforeAll(() => {
    // Required here, not at the top of the file: the module ships with #1166.
    ({
      extractEmailCopy,
    } = require('../../../packages/editor/src/js/ext/text-generation/email-copy'));
  });

  const content = (blocks, root = {}) => ({
    ...root,
    mainBlocks: { blocks },
  });

  it('lists the text of the blocks in reading order, each with its role', () => {
    const copy = extractEmailCopy(
      content([
        {
          id: 'ko_titleBlock_1',
          type: 'titleBlock',
          titleText: 'Les soldes commencent',
        },
        {
          id: 'ko_textBlock_2',
          type: 'textBlock',
          longText: '<p>Jusqu’à <strong>-50 %</strong> sur les manteaux.</p>',
        },
        {
          id: 'ko_buttonBlock_3',
          type: 'buttonBlock',
          buttonLink: {
            text: 'Je choisis mon manteau',
            url: 'https://example.com/soldes',
          },
        },
      ])
    );
    expect(copy).toEqual([
      { role: 'title', text: 'Les soldes commencent' },
      { role: 'text', text: 'Jusqu’à -50 % sur les manteaux.' },
      { role: 'button', text: 'Je choisis mon manteau' },
    ]);
  });

  it('keeps the order of the fields inside a block', () => {
    const copy = extractEmailCopy(
      content([
        {
          id: 'ko_sideArticleBlock_1',
          type: 'sideArticleBlock',
          titleText: 'Webinaire : 3 astuces',
          longText: '<p>Mardi 15 mars à 11h.</p>',
          buttonLink: { text: 'Je m’inscris', url: 'https://example.com' },
        },
      ])
    );
    expect(copy.map((piece) => piece.role)).toEqual([
      'title',
      'text',
      'button',
    ]);
  });

  it('leaves out what the reader does not see: a field switched off, a whole hidden part', () => {
    const copy = extractEmailCopy(
      content([
        {
          id: 'ko_sideArticleBlock_1',
          type: 'sideArticleBlock',
          titleVisible: false,
          titleText: 'Titre masqué',
          longText: '<p>Texte affiché</p>',
          buttonVisible: false,
          buttonLink: { text: 'Bouton masqué', url: 'https://example.com' },
        },
      ])
    );
    expect(copy).toEqual([{ role: 'text', text: 'Texte affiché' }]);
  });

  it('leaves out image alternatives, links and styles', () => {
    const copy = extractEmailCopy(
      content([
        {
          id: 'ko_imageBlock_1',
          type: 'imageBlock',
          image: {
            src: 'https://example.com/a.jpg',
            alt: 'Un manteau rouge',
            url: 'https://example.com',
          },
          backgroundColor: '#ffffff',
          longText: '<p>Légende de l’image</p>',
        },
      ])
    );
    expect(copy).toEqual([{ role: 'text', text: 'Légende de l’image' }]);
  });

  it('leaves out what is outside the blocks: preheader, header and footer of the template', () => {
    const copy = extractEmailCopy(
      content(
        [{ id: 'ko_textBlock_1', type: 'textBlock', longText: '<p>Corps</p>' }],
        {
          preheaderText: 'Le préheader',
          preheaderBlock: { preheaderText: 'Autre préheader' },
          footerBlock: { longText: 'Se désabonner' },
        }
      )
    );
    expect(copy).toEqual([{ role: 'text', text: 'Corps' }]);
  });

  it('turns rich text into plain text, entities decoded and spaces collapsed', () => {
    const copy = extractEmailCopy(
      content([
        {
          id: 'ko_textBlock_1',
          type: 'textBlock',
          longText:
            '<p>Bonjour&nbsp;!</p>\n<p>Prix&nbsp;:   <em>12&nbsp;€</em> &amp; livraison</p>',
        },
      ])
    );
    expect(copy).toEqual([
      { role: 'text', text: 'Bonjour ! Prix : 12 € & livraison' },
    ]);
  });

  it('keeps personalization variables as they are written', () => {
    const copy = extractEmailCopy(
      content([
        {
          id: 'ko_textBlock_1',
          type: 'textBlock',
          longText: '<p>Bonjour {{prenom}}, votre code %%CODE%%</p>',
        },
      ])
    );
    expect(copy).toEqual([
      { role: 'text', text: 'Bonjour {{prenom}}, votre code %%CODE%%' },
    ]);
  });

  it('skips empty texts and returns an empty list for an email without blocks', () => {
    expect(
      extractEmailCopy(
        content([
          {
            id: 'ko_textBlock_1',
            type: 'textBlock',
            longText: '<p>&nbsp;</p>',
            titleText: '  ',
          },
        ])
      )
    ).toEqual([]);
    expect(extractEmailCopy({})).toEqual([]);
  });
});

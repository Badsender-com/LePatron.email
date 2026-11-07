/**
 * @jest-environment jsdom
 */
'use strict';

/**
 * Acceptance tests of text generation (epic #1163): the text the editor sends.
 *
 * The skill reads the email as the user sees it, block after block, each piece
 * of text with its role. Seam: a pure function over the editor's rendering,
 * where every editable text carries the id `ko_<block>_<n>_<field>` and the
 * parts a template hides are simply not rendered (or rendered hidden).
 */

const {
  extractEmailCopy,
} = require('../../../packages/editor/src/js/ext/text-generation/email-copy');

function render(html) {
  document.body.innerHTML = `<div id="main-wysiwyg-area">${html}</div>`;
  return document.getElementById('main-wysiwyg-area');
}

const field = (block, name, html, tag = 'p', attrs = '') =>
  `<${tag} id="${block}_${name}" contenteditable="true" ${attrs}>${html}</${tag}>`;

describe('editor: extracting the email copy', () => {
  it('lists the text of the blocks in reading order, each with its role', () => {
    const root = render(`
      <div id="ko_coverBlock_3">
        ${field('ko_coverBlock_3', 'badsendertitleText', 'Mesure prise', 'h2')}
        ${field(
          'ko_coverBlock_3',
          'badsendertextfirstText',
          '<p>Bon taux d’ouverture : <strong>où vous situez-vous</strong> ?</p>',
          'div'
        )}
        ${field('ko_coverBlock_3', 'ctabadsenderText', 'Je lis l’article', 'a')}
      </div>`);
    expect(extractEmailCopy(root)).toEqual([
      { role: 'title', text: 'Mesure prise' },
      { role: 'text', text: 'Bon taux d’ouverture : où vous situez-vous ?' },
      { role: 'button', text: 'Je lis l’article' },
    ]);
  });

  it('takes the role from the field name when the tag says nothing', () => {
    const root = render(`
      <div id="ko_articleBlock_1">
        ${field(
          'ko_articleBlock_1',
          'titleText',
          'Webinaire : 3 astuces',
          'div'
        )}
        ${field('ko_articleBlock_1', 'buttonText', 'Je m’inscris', 'span')}
      </div>`);
    expect(extractEmailCopy(root).map((piece) => piece.role)).toEqual([
      'title',
      'button',
    ]);
  });

  it('leaves out a field the rendering hides', () => {
    const root = render(`
      <div id="ko_coverBlock_3">
        ${field('ko_coverBlock_3', 'badsendertitleText', 'Affiché', 'h2')}
        <div style="display: none">
          ${field('ko_coverBlock_3', 'badsendersubtitleText', 'Subtitle')}
        </div>
        ${field(
          'ko_coverBlock_3',
          'badsendercoverlist1Text',
          'List text 1',
          'p',
          'style="visibility: hidden"'
        )}
        ${field('ko_coverBlock_3', 'badsendertextfirstText', 'Texte affiché')}
      </div>`);
    expect(extractEmailCopy(root).map((piece) => piece.text)).toEqual([
      'Affiché',
      'Texte affiché',
    ]);
  });

  it('leaves out the header and footer blocks, the frame of the email', () => {
    const root = render(`
      <div id="ko_headerBlock_1">${field(
        'ko_headerBlock_1',
        'ctabadsenderText',
        'TRANSFÉRER',
        'a'
      )}</div>
      <div id="ko_preheaderBlock_4">${field(
        'ko_preheaderBlock_4',
        'preheaderText',
        'Le préheader'
      )}</div>
      <div id="ko_coverBlock_3">${field(
        'ko_coverBlock_3',
        'badsendertitleText',
        'Mesure prise',
        'h2'
      )}</div>
      <div id="ko_footerBlock_2">${field(
        'ko_footerBlock_2',
        'badsendertextText',
        'Se désabonner'
      )}</div>`);
    expect(extractEmailCopy(root)).toEqual([
      { role: 'title', text: 'Mesure prise' },
    ]);
  });

  it('leaves out a text left at the template sample value', () => {
    const root = render(`
      <div id="ko_coverBlock_3">
        ${field('ko_coverBlock_3', 'badsendertitleText', 'Title', 'h2')}
        ${field(
          'ko_coverBlock_3',
          'badsendertextfirstText',
          'Un vrai paragraphe'
        )}
        ${field('ko_coverBlock_3', 'ctabadsenderText', 'CALL TO ACTION', 'a')}
      </div>`);
    const samples = {
      badsendertitleText: '\n      Title\n    ',
      badsendertextfirstText: 'Text 01',
      ctabadsenderText: '<span>CALL TO ACTION</span>',
    };
    const sampleFor = (blockType, name) =>
      blockType === 'coverBlock' ? samples[name] : undefined;
    expect(extractEmailCopy(root, { sampleFor })).toEqual([
      { role: 'text', text: 'Un vrai paragraphe' },
    ]);
  });

  it('turns rich text into plain text, line breaks and paragraphs as spaces', () => {
    const root = render(`
      <div id="ko_textBlock_1">
        ${field(
          'ko_textBlock_1',
          'longText',
          '<p>Bonne rentrée à vous !<br>Marion</p><p>Prix&nbsp;: <em>12&nbsp;€</em> &amp; livraison</p>',
          'div'
        )}
      </div>`);
    expect(extractEmailCopy(root)).toEqual([
      {
        role: 'text',
        text: 'Bonne rentrée à vous ! Marion Prix : 12 € & livraison',
      },
    ]);
  });

  it('keeps personalization variables as they are written', () => {
    const root = render(`
      <div id="ko_textBlock_1">${field(
        'ko_textBlock_1',
        'longText',
        'Bonjour {{prenom}}, votre code %%CODE%%'
      )}</div>`);
    expect(extractEmailCopy(root)).toEqual([
      { role: 'text', text: 'Bonjour {{prenom}}, votre code %%CODE%%' },
    ]);
  });

  it('skips empty texts, non-editable nodes, and returns nothing for an empty email', () => {
    const root = render(`
      <div id="ko_textBlock_1">
        ${field('ko_textBlock_1', 'longText', '<p>&nbsp;</p>')}
        <p id="ko_textBlock_1_image">Not editable</p>
      </div>`);
    expect(extractEmailCopy(root)).toEqual([]);
    expect(extractEmailCopy(render(''))).toEqual([]);
  });
});

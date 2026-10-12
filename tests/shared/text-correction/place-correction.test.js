'use strict';

/**
 * Acceptance tests of the spelling correction (epic #1251, ADR 0005): placing
 * a correction in the HTML of a field.
 *
 * Seam: a pure module shared by the server, which drops what it cannot place,
 * and by the editor, which writes an accepted correction. The model never sees
 * the HTML: the code finds the text before in the text nodes and replaces it
 * there only, so tags, attributes, entities and merge tags stay as they were.
 */

// Turned on by #1254 (correct a field)
describe.skip('spelling correction: placing a correction', () => {
  let placeCorrection;
  let visibleText;

  beforeAll(() => {
    ({
      placeCorrection,
      visibleText,
    } = require('../../../packages/shared/text-correction/place-correction'));
  });

  describe('the visible text of a field', () => {
    it('is the text without tags, a line per paragraph or line break', () => {
      expect(
        visibleText(
          '<p>Les <strong>soldes</strong></p><p>commencent<br>demain</p>'
        )
      ).toBe('Les soldes\ncommencent\ndemain');
    });

    it('decodes the entities, a non-breaking space kept as one', () => {
      expect(visibleText('L&#39;été arrive&nbsp;! R&amp;D')).toBe(
        "L'été arrive\u00a0! R&D"
      );
    });
  });

  describe('placing a correction', () => {
    it('replaces the text before in a text node', () => {
      expect(
        placeCorrection('<p>Les soldes commence demain</p>', {
          before: 'soldes commence',
          after: 'soldes commencent',
        })
      ).toEqual({ html: '<p>Les soldes commencent demain</p>' });
    });

    it('keeps the markup around it', () => {
      expect(
        placeCorrection(
          '<p>Profitez de <strong>-30 %</strong> sur la colection</p>',
          { before: 'la colection', after: 'la collection' }
        )
      ).toEqual({
        html: '<p>Profitez de <strong>-30 %</strong> sur la collection</p>',
      });
    });

    it('never touches an attribute: a link’s address keeps its own spelling', () => {
      expect(
        placeCorrection(
          '<a href="https://example.com/colection">Voir la colection</a>',
          { before: 'la colection', after: 'la collection' }
        )
      ).toEqual({
        html: '<a href="https://example.com/colection">Voir la collection</a>',
      });
    });

    it('keeps the entities it does not change, and writes a non-breaking space as one', () => {
      expect(
        placeCorrection('L&#39;été arrive bientot ! Vite !', {
          before: 'Vite !',
          after: 'Vite\u00a0!',
        })
      ).toEqual({ html: 'L&#39;été arrive bientot ! Vite&nbsp;!' });
    });

    it('escapes what it writes', () => {
      expect(
        placeCorrection('Notre equipe R et D', {
          before: 'R et D',
          after: 'R&D',
        })
      ).toEqual({ html: 'Notre equipe R&amp;D' });
    });
  });

  describe('refusing a correction it cannot place safely', () => {
    it.each([
      [
        'not-found',
        '<p>Les soldes commencent</p>',
        { before: 'Les solde', after: 'Les soldes' },
      ],
      ['ambiguous', '<p>la la la</p>', { before: 'la', after: 'là' }],
      [
        'straddles-markup',
        '<p>Les <strong>soldes</strong> commence</p>',
        { before: 'soldes commence', after: 'soldes commencent' },
      ],
      [
        'merge-tag',
        '<p>Bonjour {{prenom}} !</p>',
        { before: '{{prenom}} !', after: '{{prenom}}\u00a0!' },
      ],
      [
        'merge-tag',
        '<p>Bonjour *|FNAME|*, merci</p>',
        { before: '*|FNAME|*,', after: '*|FNAME|* ,' },
      ],
      [
        'merge-tag',
        '<p>Bonjour %%PRENOM%%</p>',
        { before: '%%PRENOM%%', after: '%%Prénom%%' },
      ],
      ['unchanged', '<p>Les soldes</p>', { before: 'soldes', after: 'soldes' }],
    ])(
      'refuses (%s) and leaves the HTML as it was',
      (reason, html, correction) => {
        expect(placeCorrection(html, correction)).toEqual({ refused: reason });
      }
    );
  });
});

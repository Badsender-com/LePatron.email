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

describe('spelling correction: placing a correction', () => {
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

    it('decodes the entities by their case, and the whole Latin-1 set', () => {
      expect(
        visibleText('&Eacute;t&eacute; c&oelig;ur &agrave; &Ccedil;a')
      ).toBe('\u00c9t\u00e9 c\u0153ur \u00e0 \u00c7a');
    });

    it('keeps an entity out of the Unicode range as it is, rather than failing', () => {
      expect(visibleText('a &#1114112; b')).toBe('a &#1114112; b');
    });

    it('reads the line breaks and indentation of the source as one space, as the rendering does', () => {
      expect(
        visibleText('<p>D\u00e9couvrez nos\n      nouveaut\u00e9s</p>')
      ).toBe('D\u00e9couvrez nos nouveaut\u00e9s');
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

    it('places a correction across the indentation of the source', () => {
      expect(
        placeCorrection('<p>D\u00e9couvrez nos\n   nouveaut\u00e9</p>', {
          before: 'nos nouveaut\u00e9',
          after: 'nos nouveaut\u00e9s',
        })
      ).toEqual({ html: '<p>D\u00e9couvrez nos nouveaut\u00e9s</p>' });
    });

    it('reads an attribute holding a ">" as part of its tag, never as text', () => {
      const html =
        '<p>Voir <a href="https://x.fr" title="Prix > 10">notre ofre</a></p>';
      expect(
        placeCorrection(html, { before: 'notre ofre', after: 'notre offre' })
      ).toEqual({
        html:
          '<p>Voir <a href="https://x.fr" title="Prix > 10">notre offre</a></p>',
      });
      // The attribute's text is not visible: a correction cannot reach it.
      expect(
        placeCorrection(html, {
          before: '10',
          after: '10" onmouseover="alert(1)',
        })
      ).toEqual({ refused: 'not-found' });
    });

    it('escapes the quotes it writes too', () => {
      expect(
        placeCorrection('<p>Il dit bonjour</p>', {
          before: 'dit bonjour',
          after: 'dit "bonjour"',
        })
      ).toEqual({ html: '<p>Il dit &quot;bonjour&quot;</p>' });
    });

    it('writes a plain text value as it is: an alternative text is no HTML', () => {
      expect(
        placeCorrection(
          'Une robe en lin bleu de R et D',
          { before: 'R et D', after: 'R&D' },
          { plainText: true }
        )
      ).toEqual({ html: 'Une robe en lin bleu de R&D' });
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
        { before: 'Les solde', after: 'Les soldés' },
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
      [
        'invalid-text',
        '<p>Bon taux de clic: où</p>',
        { before: 'de clic:', after: 'de clic\b\ffinal:' },
      ],
      ['unchanged', '<p>Les soldes</p>', { before: 'soldes', after: 'soldes' }],
      // A correction never brings a merge tag the text did not have: the
      // sending platform would run it.
      [
        'merge-tag',
        '<p>Bonjour, \u00e0 demain</p>',
        { before: 'Bonjour', after: 'Bonjour {{prenom}}' },
      ],
      // A bidirectional control character would disguise the change shown.
      [
        'invalid-text',
        '<p>Les soldes</p>',
        { before: 'soldes', after: 'sol\u202edes' },
      ],
      // The visible text has a line per paragraph; the model's excerpt may
      // not straddle two.
      [
        'multiline',
        '<p>Les soldes</p><p>commence demain</p>',
        { before: 'soldes\ncommence', after: 'soldes\ncommencent' },
      ],
      // The text already holds the non-breaking space the model could not see.
      [
        'already-applied',
        '<p>Verdict&nbsp;: anonymiser</p>',
        { before: 'Verdict : anonymiser', after: 'Verdict\u00a0: anonymiser' },
      ],
    ])(
      'refuses (%s) and leaves the HTML as it was',
      (reason, html, correction) => {
        expect(placeCorrection(html, correction)).toEqual({ refused: reason });
      }
    );
  });
});

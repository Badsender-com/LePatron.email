'use strict';

// Renders every element in every shape worth checking, as one complete email.
//
// This is how the generated markup gets validated BEFORE the feature exists in
// the product: build the file, open it, send it through Litmus or Email on
// Acid, and read the result in real clients. No editor, no database, no flag —
// so a rendering problem is found while templates are still cheap to change.
//
// The specimens are the review checklist made executable. Each one exists
// because something about it can break on its own.
//
// Dev tooling, so it lives in scripts/ rather than in packages/shared, which
// ships with the product; build-block-builder-gallery.js is its command.

const { renderDocument } = require('./block-builder/gallery-document.js');

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod ' +
  'tempor incididunt ut labore et dolore magna aliqua.';

// A real, stable, 600px-wide image, so the gallery can be opened offline-ish
// and in a client that blocks nothing.
const IMAGE = 'https://placehold.co/600x200/png';

let sequence = 0;
const id = () => `spec-${++sequence}`;

/**
 * @param {string} title shown above the specimen
 * @param {Array<Object>} elements
 * @returns {Object} a labelled specimen
 */
function specimen(title, elements, block) {
  return {
    title,
    state: {
      block: {
        backgroundColor: '#ffffff',
        paddingTop: 8,
        paddingBottom: 8,
        ...block,
      },
      // One full-width column: a flat composition, rendered as one.
      rows: [
        {
          id: id(),
          columns: [
            {
              width: 100,
              elements: elements.map((element) => ({ id: id(), ...element })),
            },
          ],
        },
      ],
    },
  };
}

/**
 * A specimen laid out in columns: one row, each column given as
 * `[width, elements]`.
 *
 * @param {string} title
 * @param {Array<Array>} columns
 * @param {Object} [settings] the row's own, such as its spacing
 * @returns {Object} a labelled specimen
 */
function rowSpecimen(title, columns, settings) {
  return {
    title,
    state: {
      block: { backgroundColor: '#ffffff', paddingTop: 8, paddingBottom: 8 },
      rows: [
        {
          id: id(),
          columns: columns.map(([width, elements]) => ({
            width,
            elements: elements.map((element) => ({ id: id(), ...element })),
          })),
          ...settings,
        },
      ],
    },
  };
}

const text = (overrides) => ({ type: 'text', content: LOREM, ...overrides });
const picture = { type: 'image', src: IMAGE, alt: 'Visuel de démonstration' };

/**
 * @returns {Array<Object>}
 */
function specimens() {
  sequence = 0;

  return [
    specimen('Texte — réglages par défaut', [text()]),

    specimen('Texte — alignements', [
      text({ content: 'Aligné à gauche', align: 'left' }),
      text({ content: 'Centré', align: 'center' }),
      text({ content: 'Aligné à droite', align: 'right' }),
    ]),

    // The allow-list, rendered: what a writer pastes must come out readable.
    specimen('Texte — mise en forme autorisée', [
      text({
        content:
          "Du <strong>gras</strong>, de l'<em>italique</em>, du <u>souligné</u>, " +
          'un <a href="https://www.badsender.com">lien</a>,<br />et un retour à la ligne.',
      }),
    ]),

    specimen('Texte — tailles', [
      text({ content: 'Titre 28px', fontSize: 28, lineHeight: 34 }),
      text({ content: 'Corps 14px' }),
      text({ content: 'Mention 11px', fontSize: 11, lineHeight: 16 }),
    ]),

    specimen('Image — pleine largeur, sans lien', [
      { type: 'image', src: IMAGE, alt: 'Visuel de démonstration', width: 600 },
    ]),

    specimen('Image — réduite et centrée, avec lien', [
      {
        type: 'image',
        src: IMAGE,
        alt: 'Visuel cliquable',
        href: 'https://www.badsender.com',
        width: 300,
        align: 'center',
      },
    ]),

    // The one that degrades on Outlook, by design: square corners there.
    specimen('Bouton — libellé court et libellé long', [
      {
        type: 'button',
        label: 'Je découvre',
        href: 'https://www.badsender.com',
      },
      {
        type: 'button',
        label: 'Un libellé nettement plus long pour vérifier la largeur',
        href: 'https://www.badsender.com',
      },
    ]),

    specimen('Bouton — couleurs et arrondi', [
      {
        type: 'button',
        label: 'Arrondi complet',
        href: 'https://www.badsender.com',
        backgroundColor: '#a9a2f7',
        borderRadius: 50,
      },
      {
        type: 'button',
        label: 'Coins droits',
        href: 'https://www.badsender.com',
        backgroundColor: '#1b1d29',
        borderRadius: 0,
      },
    ]),

    specimen('Séparateur — épaisseurs et largeurs', [
      { type: 'divider' },
      { type: 'divider', thickness: 3, color: '#a9a2f7' },
      { type: 'divider', width: '50%' },
    ]),

    specimen('Espaceur — 8, 24 et 64 px', [
      text({ content: 'Avant' }),
      { type: 'spacer', height: 8 },
      text({ content: 'Après 8px' }),
      { type: 'spacer', height: 24 },
      text({ content: 'Après 24px' }),
      { type: 'spacer', height: 64 },
      text({ content: 'Après 64px' }),
    ]),

    specimen(
      'Bloc — fond coloré et respiration',
      [text({ content: 'Sur un fond gris, avec du padding vertical.' })],
      { backgroundColor: '#f6f6f6', paddingTop: 32, paddingBottom: 32 }
    ),

    // Everything at once, which is what a real block looks like.
    specimen('Bloc complet', [
      { type: 'image', src: IMAGE, alt: '', width: 600 },
      text({
        content: '<strong>Un titre accrocheur</strong>',
        fontSize: 24,
        lineHeight: 30,
        align: 'center',
      }),
      text({ content: LOREM, align: 'center' }),
      {
        type: 'button',
        label: "Passer à l'action",
        href: 'https://www.badsender.com',
      },
      { type: 'spacer', height: 16 },
      { type: 'divider' },
    ]),

    // Columns. Each image is 600px wide as stored: in Outlook on Windows, which
    // ignores max-width, it must still come out no wider than its column. On a
    // phone, below 600px, the columns stack.
    rowSpecimen('Colonnes — 50 / 50, image et texte', [
      [50, [picture]],
      [
        50,
        [
          text(),
          {
            type: 'button',
            label: 'Je découvre',
            href: 'https://www.badsender.com',
          },
        ],
      ],
    ]),

    rowSpecimen('Colonnes — 33 / 33 / 34, une image et un texte chacune', [
      [33, [picture, text({ content: 'Première colonne' })]],
      [33, [picture, text({ content: 'Deuxième colonne' })]],
      [34, [picture, text({ content: 'Troisième colonne' })]],
    ]),

    rowSpecimen('Colonnes — 66 / 34, texte et image', [
      [66, [text({ content: '<strong>Un titre</strong><br />' + LOREM })]],
      [34, [picture]],
    ]),

    // Images side by side used to touch. On a desktop, two gutters of their
    // own, 12px then 36px, none on the outer edges, and three images of the
    // same 184px; on a phone, no gutter, and 16px between the stacked images.
    // Widths in px from here on: the columns and the gutters fill the 600px.
    rowSpecimen(
      'Colonnes — 3 × 184 px, gouttières 12 et 36 px (bureau), espacement 16 px (mobile)',
      [
        [184, [picture]],
        [184, [picture]],
        [184, [picture]],
      ],
      { gutters: [12, 36], stackSpacing: 16 }
    ),
  ];
}

/**
 * The whole gallery, as a standalone email document.
 *
 * @returns {string}
 */
const renderGallery = () => renderDocument(specimens());

module.exports = { renderGallery, specimens };

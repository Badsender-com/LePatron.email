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

const { generate, GENERATOR_VERSION } = require('./generate.js');

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
      elements: elements.map((element) => ({ id: id(), ...element })),
    },
  };
}

const text = (overrides) => ({ type: 'text', content: LOREM, ...overrides });

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
  ];
}

/**
 * @param {Object} spec
 * @returns {string}
 */
function renderSpecimen(spec) {
  return (
    '<tr><td style="padding:24px 0 4px 0; font-family:Arial,sans-serif;' +
    ' font-size:11px; color:#888888; text-transform:uppercase;' +
    ' letter-spacing:.08em;">' +
    spec.title +
    '</td></tr>' +
    '<tr><td style="border:1px dashed #dddddd;">' +
    generate(spec.state) +
    '</td></tr>'
  );
}

/**
 * The whole gallery, as a standalone email document.
 *
 * @returns {string}
 */
function renderGallery() {
  const body = specimens().map(renderSpecimen).join('');

  return [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"',
    ' "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<html xmlns="http://www.w3.org/1999/xhtml"',
    ' xmlns:v="urn:schemas-microsoft-com:vml"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office">',
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>Block Builder — galerie de contrôle (générateur ${GENERATOR_VERSION})</title>`,
    '<!--[if mso]><xml><o:OfficeDocumentSettings>',
    '<o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch>',
    '</o:OfficeDocumentSettings></xml><![endif]-->',
    '<style type="text/css">',
    'body{margin:0;padding:0;background-color:#eeeeee;}',
    'table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}',
    'img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}',
    '</style>',
    '</head>',
    '<body style="margin:0; padding:0; background-color:#eeeeee;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">',
    '<tr><td align="center" style="padding:24px 12px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"',
    ' width="600" style="width:600px; max-width:600px; background-color:#ffffff;">',
    '<tr><td style="padding:24px 24px 0 24px; font-family:Arial,sans-serif;',
    ' font-size:18px; font-weight:bold; color:#1b1d29;">',
    'Block Builder — galerie de contrôle',
    '</td></tr>',
    '<tr><td style="padding:4px 24px 0 24px; font-family:Arial,sans-serif;',
    ' font-size:12px; line-height:18px; color:#666666;">',
    `Générateur ${GENERATOR_VERSION}. Chaque encadré est un bloc produit par le `,
    "générateur, tel qu'il partirait à l'export. À ouvrir dans Litmus ou Email ",
    'on Acid, et à lire dans Outlook, Gmail et Apple Mail.',
    '</td></tr>',
    '<tr><td style="padding:0 24px 24px 24px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">',
    body,
    '</table>',
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('');
}

module.exports = { renderGallery, specimens };

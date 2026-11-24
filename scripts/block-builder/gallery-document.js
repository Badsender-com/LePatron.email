'use strict';

// The gallery's document: the email that holds every specimen, each under its
// title, with the stylesheet the specimens derive. The specimens themselves
// are block-builder-gallery.js.

const {
  generate,
  GENERATOR_VERSION,
} = require('../../packages/shared/block-builder/generate.js');
const {
  collectCssFor,
} = require('../../packages/shared/block-builder/stylesheet.js');

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
 * @param {Array<Object>} specimens what block-builder-gallery.js lists
 * @returns {string}
 */
function renderDocument(specimens) {
  const body = specimens.map(renderSpecimen).join('');

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
    // The stylesheet the specimens derive, as an export carries it: the
    // columns stack on a phone, drop their gutter and keep their spacing, as
    // they will in a mailing.
    collectCssFor(specimens.map((spec) => spec.state)),
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

module.exports = { renderDocument };

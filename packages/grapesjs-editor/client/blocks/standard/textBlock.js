/**
 * Text Block - Bloc de texte riche éditable
 *
 * Compatible email avec:
 * - Table structure
 * - Inline styles
 * - Editable content
 */

export default {
  id: 'textBlock',
  label: 'Bloc Texte',
  category: 'Basic',
  media: `
    <svg viewBox="0 0 24 24" width="48" height="48">
      <path fill="currentColor" d="M3 5h18v2H3V5m0 6h18v2H3v-2m0 6h12v2H3v-2z"/>
    </svg>
  `,
  content: `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="padding: 24px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 21px; color: #333333; text-align: left;">
          <p style="margin: 0; margin-bottom: 12px;">
            Ceci est un paragraphe éditable. Vous pouvez modifier ce texte,
            ajouter des liens, mettre en <strong>gras</strong> ou en <em>italique</em>.
          </p>
          <p style="margin: 0;">
            Vous pouvez ajouter plusieurs paragraphes dans ce bloc.
          </p>
        </td>
      </tr>
    </table>
  `,
};

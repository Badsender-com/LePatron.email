/**
 * Title Block - Bloc de titre (H1/H2/H3)
 *
 * Compatible email avec:
 * - Table structure
 * - Inline styles
 * - Customizable heading level
 */

export default {
  id: 'titleBlock',
  label: 'Bloc Titre',
  category: 'Basic',
  media: `
    <svg viewBox="0 0 24 24" width="48" height="48">
      <path fill="currentColor" d="M5 4v3h5.5v12h3V7H19V4z"/>
    </svg>
  `,
  content: `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="padding: 24px;">
          <h2 style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: bold; color: #000000; line-height: 1.3;">
            Titre de section
          </h2>
        </td>
      </tr>
    </table>
  `,
};

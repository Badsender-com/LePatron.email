/**
 * Spacer Block - Espacement vertical
 *
 * Compatible email avec:
 * - Table structure
 * - Configurable height
 * - Works in all email clients
 */

export default {
  id: 'spacerBlock',
  label: 'Espacement',
  category: 'Layout',
  media: `
    <svg viewBox="0 0 24 24" width="48" height="48">
      <path fill="currentColor" d="M3 5h18v2H3V5m0 12h18v2H3v-2z"/>
    </svg>
  `,
  content: `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="height: 40px; font-size: 0; line-height: 0;">
          &nbsp;
        </td>
      </tr>
    </table>
  `,
};

/**
 * Divider Block - Séparateur horizontal
 *
 * Compatible email avec:
 * - Table structure
 * - Border-based divider (more reliable than <hr>)
 */

export default {
  id: 'dividerBlock',
  label: 'Séparateur',
  category: 'Layout',
  media: `
    <svg viewBox="0 0 24 24" width="48" height="48">
      <path fill="currentColor" d="M3 11h18v2H3z"/>
    </svg>
  `,
  content: `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="padding: 24px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
            <tr>
              <td style="border-top: 1px solid #cccccc; font-size: 0; line-height: 0;">
                &nbsp;
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `,
};

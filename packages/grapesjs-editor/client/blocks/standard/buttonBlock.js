/**
 * Button Block - Bloc bouton CTA
 *
 * Compatible email avec:
 * - Table structure (bulletproof button)
 * - VML for Outlook
 * - Inline styles
 */

export default {
  id: 'buttonBlock',
  label: 'Bloc Bouton',
  category: 'Basic',
  media: `
    <svg viewBox="0 0 24 24" width="48" height="48">
      <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
    </svg>
  `,
  content: `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="padding: 24px; text-align: center;">
          <!-- Bulletproof Button -->
          <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
            <tr>
              <td align="center" bgcolor="#000000" style="border-radius: 3px; background-color: #000000;">
                <a
                  href="#"
                  target="_blank"
                  style="display: inline-block; padding: 12px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 3px; -webkit-text-size-adjust: none;"
                >
                  CLIQUEZ ICI
                </a>
              </td>
            </tr>
          </table>
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="#" style="height:40px;v-text-anchor:middle;width:150px;" arcsize="8%" strokecolor="#000000" fillcolor="#000000">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">CLIQUEZ ICI</center>
          </v:roundrect>
          <![endif]-->
        </td>
      </tr>
    </table>
  `,
};

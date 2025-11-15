/**
 * Image Block - Bloc image avec lien optionnel
 *
 * Compatible email avec:
 * - Table structure
 * - Responsive image
 * - Optional link wrapper
 */

export default {
  id: 'imageBlock',
  label: 'Bloc Image',
  category: 'Basic',
  media: `
    <svg viewBox="0 0 24 24" width="48" height="48">
      <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
    </svg>
  `,
  content: `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="padding: 24px; text-align: center;">
          <img
            src="https://via.placeholder.com/600x300/CCCCCC/666666?text=Image"
            alt="Image"
            width="600"
            style="width: 100%; max-width: 600px; height: auto; display: block; margin: 0 auto; border: 0;"
          />
        </td>
      </tr>
    </table>
  `,
};

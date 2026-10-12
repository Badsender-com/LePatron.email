import { ERROR_CODES } from '~/helpers/constants/error-codes.js';

// The preview modal used to say "the preview will be generated when opening the
// editor" for any failure, a refusal included, to users who may not open the
// editor at all. Only the server knows why there is no preview, so the message
// follows its error code, not the HTTP status: a 404 also means "not found".

function errorCode(error) {
  let body = error?.response?.data;
  // The preview is requested as text, so an error body arrives as a JSON string.
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  return body?.message;
}

/**
 * i18n keys of the message shown when the preview cannot be displayed.
 * @param {Error} error the failed request
 * @param {Object} options
 * @param {boolean} options.canEdit whether the user may open the editor
 * @returns {{ title: string, subtitle: string }}
 */
export function previewErrorMessages(error, { canEdit }) {
  if (errorCode(error) !== ERROR_CODES.MAILING_PREVIEW_NOT_GENERATED) {
    return {
      title: 'mailings.previewUnavailable',
      subtitle: 'mailings.subPreviewUnavailable',
    };
  }
  return {
    title: 'mailings.errorPreview',
    subtitle: canEdit
      ? 'mailings.subErrorPreview'
      : 'mailings.subErrorPreviewReadOnly',
  };
}

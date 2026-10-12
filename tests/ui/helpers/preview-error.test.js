import { previewErrorMessages } from '~/helpers/preview-error.js';

// The preview modal said "the preview will be generated when opening the
// editor" for any failure: to a user refused the preview, and to a read-only
// user who cannot open the editor. The message now follows the server's code.

// The modal requests the preview as text, so axios hands the error body over as
// a JSON string.
function failure(status, message) {
  return {
    response: { status, data: JSON.stringify({ status, message }) },
  };
}

const NOT_GENERATED = failure(404, 'MAILING_PREVIEW_NOT_GENERATED');

describe('previewErrorMessages', () => {
  it('tells an editor that opening the editor generates the preview', () => {
    expect(previewErrorMessages(NOT_GENERATED, { canEdit: true })).toEqual({
      title: 'mailings.errorPreview',
      subtitle: 'mailings.subErrorPreview',
    });
  });

  it('does not send a read-only user to the editor', () => {
    expect(previewErrorMessages(NOT_GENERATED, { canEdit: false })).toEqual({
      title: 'mailings.errorPreview',
      subtitle: 'mailings.subErrorPreviewReadOnly',
    });
  });

  it('reads the code from an already parsed body too', () => {
    const parsed = {
      response: {
        status: 404,
        data: { message: 'MAILING_PREVIEW_NOT_GENERATED' },
      },
    };
    expect(previewErrorMessages(parsed, { canEdit: true }).title).toBe(
      'mailings.errorPreview'
    );
  });

  it.each([
    ['a refusal', failure(403, 'FORBIDDEN_RESOURCE_OR_ACTION')],
    ['a mailing not found', failure(404, 'MAILING_NOT_FOUND')],
    ['a workspace not found', failure(404, 'WORKSPACE_NOT_FOUND : Other team')],
    ['a server error', failure(500, 'an error as occurred')],
    ['a body that is not JSON', { response: { status: 502, data: '<html>' } }],
    ['a network failure', new Error('Network Error')],
  ])('says the preview could not be loaded on %s', (_, error) => {
    expect(previewErrorMessages(error, { canEdit: true })).toEqual({
      title: 'mailings.previewUnavailable',
      subtitle: 'mailings.subPreviewUnavailable',
    });
  });
});

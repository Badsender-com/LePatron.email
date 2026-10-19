/**
 * @jest-environment jsdom
 */
'use strict';

// Reopening the image editor on an image that is already stored: what it
// refuses (formats, missing pieces, rights), the email pencil's reading of
// an image source, and one opening at a time.
const editImagePlugin = require('../../packages/editor/src/js/ext/badsender-edit-image.js');
const {
  GALLERY_REQUEST_TIMEOUT_MS,
} = require('../../packages/editor/src/js/ext/gallery-request.js');
const {
  PNG,
  JPG,
  respondWith,
  setUpEditor,
  panel,
} = require('./helpers/edit-image.js');

let viewModel;
let added;

beforeEach(() => {
  ({ viewModel, added } = setUpEditor());
});

afterEach(() => {
  delete global.fetch;
});

describe('editGalleryImage — formats the editor cannot take', () => {
  // The editor flattens what it opens, so GIF and SVG never reach it. The
  // thumbnail hides its edit button for them, but the pencil on an image block
  // (editImage) has no such guard: without this, it would re-upload identical
  // bytes, a silent no-op the content-addressed name turns invisible.
  ['anim.gif', 'logo.svg'].forEach((storedName) => {
    it(`refuses ${storedName} rather than re-uploading it unchanged`, async () => {
      const opened = await viewModel.editImage(
        () => storedName,
        panel('mailing')
      );

      expect(opened).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(added).toHaveLength(0);
      expect(viewModel.notifier.error).toHaveBeenCalledWith(
        'gallery-edit-image-unsupported'
      );
    });
  });

  it('still takes jpg and png', async () => {
    await viewModel.editImage(() => JPG, panel('mailing'));
    expect(global.fetch).toHaveBeenCalled();
    expect(added).toHaveLength(1);
  });
});

describe('editGalleryImage — when it cannot', () => {
  it('reports rather than failing silently when the file is gone', async () => {
    respondWith(null, false);

    const opened = await viewModel.editGalleryImage(
      { name: PNG, label: 'photo.png' },
      'mailing',
      panel('mailing')
    );

    expect(opened).toBe(false);
    expect(added).toHaveLength(0);
    expect(viewModel.notifier.error).toHaveBeenCalledWith(
      'gallery-edit-image-fail'
    );
  });

  it('reports rather than failing silently when the network does', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    const opened = await viewModel.editGalleryImage(
      { name: PNG, label: 'photo.png' },
      'mailing',
      panel('mailing')
    );

    expect(opened).toBe(false);
    expect(viewModel.notifier.error).toHaveBeenCalled();
  });

  // `fetch` has no timeout of its own: a stalled read would hang the action.
  it('stops waiting for the stored file after the gallery budget', () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() => new Promise(() => {}));

    viewModel.editGalleryImage(
      { name: PNG, label: 'photo.png' },
      'mailing',
      panel('mailing')
    );
    const { signal } = global.fetch.mock.calls[0][1];
    jest.advanceTimersByTime(GALLERY_REQUEST_TIMEOUT_MS - 1);
    expect(signal.aborted).toBe(false);
    jest.advanceTimersByTime(1);
    expect(signal.aborted).toBe(true);
    jest.useRealTimers();
  });

  // The panel can be mounted while its upload zone is not, and a click that
  // does nothing at all is the failure mode nobody can report.
  it('reports rather than failing silently with no upload widget in reach', async () => {
    document.body.innerHTML = '<div class="gallery-vue-panel"></div>';

    const opened = await viewModel.editGalleryImage(
      { name: PNG, label: 'photo.png' },
      'mailing',
      document.querySelector('.gallery-vue-panel')
    );

    expect(opened).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(viewModel.notifier.error).toHaveBeenCalledWith(
      'gallery-edit-image-fail'
    );
  });
});

// Saving in the editor uploads a copy to the gallery, which the server
// refuses without gallery.manage. Guarded here rather than only where the
// buttons are drawn, so a new way in cannot skip it.
describe('editImage and editGalleryImage — the right to manage the gallery', () => {
  const withoutRight = [
    ['an unknown user', () => null],
    ['a user without gallery.manage', () => ({ role: 'x', capabilities: [] })],
  ];

  it.each(withoutRight)('refuses %s from the email pencil', async (_, user) => {
    viewModel.currentUser = user;
    const opened = await viewModel.editImage(() => PNG, panel('mailing'));

    expect(opened).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(added).toHaveLength(0);
    expect(viewModel.notifier.error).toHaveBeenCalledWith(
      'gallery-edit-image-forbidden'
    );
  });

  it.each(withoutRight)('refuses %s from a thumbnail', async (_, user) => {
    viewModel.currentUser = user;
    const opened = await viewModel.editGalleryImage(
      { name: PNG, label: 'photo.png' },
      'mailing',
      panel('mailing')
    );

    expect(opened).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('storedNameOf', () => {
  const { storedNameOf } = editImagePlugin;

  it('keeps a bare stored name', () => {
    expect(storedNameOf(PNG)).toBe(PNG);
  });

  it('takes the last segment of a full url', () => {
    expect(storedNameOf(`https://images.example.com/api/images/${PNG}`)).toBe(
      PNG
    );
  });

  it('drops a query string', () => {
    expect(storedNameOf(`/api/images/${PNG}?v=2`)).toBe(PNG);
  });

  it('decodes what the url encoded', () => {
    expect(storedNameOf('/api/images/mon%20image.png')).toBe('mon image.png');
  });

  // `decodeURIComponent` throws on a `%` not followed by two hex digits, and
  // that would escape the click handler before any message is shown.
  it('keeps a name with a stray % as it is rather than throwing', () => {
    expect(storedNameOf('/api/images/remise-100%.png')).toBe('remise-100%.png');
  });

  it('answers an empty string rather than throwing on nothing', () => {
    expect(storedNameOf(null)).toBe('');
    expect(storedNameOf(undefined)).toBe('');
  });
});

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

// Opening waits for up to two gallery loads and the read of the stored file,
// and each opening ends in an editor that takes over a single global state.
// A second click during the wait used to open a second editor over the first.
describe('editImage and editGalleryImage — one opening at a time', () => {
  const FILE = { name: PNG, label: 'photo.png' };
  let release;

  beforeEach(() => {
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              ok: true,
              status: 200,
              blob: () =>
                Promise.resolve(new Blob(['x'], { type: 'image/png' })),
            });
        })
    );
  });

  it('ignores a second click while the first is opening', async () => {
    const first = viewModel.editGalleryImage(FILE, 'mailing', panel('mailing'));
    const second = await viewModel.editGalleryImage(
      FILE,
      'mailing',
      panel('mailing')
    );
    release();

    expect(second).toBe(false);
    expect(await first).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(added).toHaveLength(1);
  });

  it('shares the wait between the pencil and the thumbnails', async () => {
    const pencil = document.querySelector('[data-pencil="template"]');
    const first = viewModel.editImage(() => PNG, pencil);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = await viewModel.editGalleryImage(
      FILE,
      'template',
      panel('template')
    );
    release();
    await first;

    expect(second).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('opens again once the first opening is over, even a failed one', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await viewModel.editGalleryImage(FILE, 'mailing', panel('mailing'));
    respondWith(new Blob(['x'], { type: 'image/png' }));

    const opened = await viewModel.editGalleryImage(
      FILE,
      'mailing',
      panel('mailing')
    );

    expect(opened).toBe(true);
  });

  // nothing on screen said the click was taken, which is why it was repeated
  it('marks the clicked control busy while it waits', async () => {
    const pencil = document.querySelector('[data-pencil="template"]');
    const opening = viewModel.editImage(() => PNG, pencil);
    expect(pencil.getAttribute('aria-busy')).toBe('true');
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await opening;
    expect(pencil.hasAttribute('aria-busy')).toBe(false);
  });

  it('marks the thumbnail’s button busy too', async () => {
    const button = document.createElement('button');
    panel('mailing').appendChild(button);
    const opening = viewModel.editGalleryImage(
      FILE,
      'mailing',
      panel('mailing'),
      button
    );
    expect(button.getAttribute('aria-busy')).toBe('true');
    release();
    await opening;
    expect(button.hasAttribute('aria-busy')).toBe(false);
  });
});

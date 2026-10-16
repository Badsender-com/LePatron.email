/**
 * @jest-environment jsdom
 */
'use strict';

// US-10 — reopening the image editor on an image that is already stored.
//
// The extension never talks to Konva: it hands the stored bytes back to the
// upload widget, whose own process step is what opens the editor. So what is
// asserted here is the handover — which widget, which bytes, under which name
// — plus the two things the story turns on: that an edit adds an entry rather
// than replacing one, and that the save button says so.

const $ = require('jquery');
const editImagePlugin = require('../../packages/editor/src/js/ext/badsender-edit-image.js');
const { userOfRole } = require('./helpers/current-user.js');
const {
  GALLERY_REQUEST_TIMEOUT_MS,
} = require('../../packages/editor/src/js/ext/gallery-request.js');

const PNG = '507f1f77bcf86cd799439011-aaa.png';
const JPG = '507f1f77bcf86cd799439011-bbb.jpg';

// The two panes sit side by side, each with its own upload widget. Which one
// receives the file is the whole reason the caller passes an element.
const MARKUP = `
  <div id="toolimagesgallery" class="gallery-panel">
    <div class="uploadzone">
      <input class="fileupload" data-pane="mailing" />
    </div>
    <div class="gallery-vue-host">
      <div class="gallery-vue-panel" data-panel="mailing"></div>
    </div>
  </div>
  <div id="toolimagesgallerytemplate" class="gallery-panel">
    <div class="uploadzone">
      <input class="fileupload" data-pane="template" />
      <div class="tool edit" data-pencil="template"></div>
    </div>
    <div class="gallery-vue-host">
      <div class="gallery-vue-panel" data-panel="template"></div>
    </div>
  </div>
`;

let viewModel;
let added;

// `loaded: false` is an editor where neither gallery was opened yet: the
// observables are empty until something asks for them to be loaded.
function makeViewModel(mailing = [], template = [], { loaded = true } = {}) {
  const lists = { mailing, template };
  const shown = loaded ? { ...lists } : { mailing: [], template: [] };
  return {
    mailingGallery: () => shown.mailing,
    templateGallery: () => shown.template,
    loadedGallery: jest.fn((type) => {
      shown[type] = lists[type];
      return Promise.resolve(shown[type]);
    }),
    currentUser: userOfRole('regular_user'),
    notifier: { success: jest.fn(), error: jest.fn() },
    t: (key) => key,
  };
}

function respondWith(blob, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    blob: () => Promise.resolve(blob),
  });
}

beforeEach(() => {
  document.body.innerHTML = MARKUP;
  added = [];
  // the real widget is a blueimp plugin; only the handover is under test
  $.fn.fileupload = function (action, data) {
    added.push({ pane: this.attr('data-pane'), action, data });
    return this;
  };
  respondWith(new Blob(['pixels'], { type: 'image/png' }));
  viewModel = makeViewModel();
  editImagePlugin(viewModel);
});

afterEach(() => {
  delete global.fetch;
});

const panel = (type) => document.querySelector(`[data-panel="${type}"]`);

describe('editGalleryImage — the handover', () => {
  it('reads the stored file from this application, not from a display url', async () => {
    await viewModel.editGalleryImage(
      { name: PNG, label: 'photo.png', url: 'https://cdn.example/elsewhere' },
      'mailing',
      panel('mailing')
    );

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/images/${PNG}`,
      expect.objectContaining({ credentials: 'same-origin' })
    );
  });

  it('hands the file to the upload widget of its own pane', async () => {
    await viewModel.editGalleryImage(
      { name: PNG, label: 'photo.png' },
      'template',
      panel('template')
    );

    expect(added).toHaveLength(1);
    expect(added[0].pane).toBe('template');
    expect(added[0].action).toBe('add');
  });

  it('finds the widget from the pencil inside an upload zone too', async () => {
    await viewModel.editImage(
      () => PNG,
      document.querySelector('[data-pencil="template"]')
    );

    expect(added[0].pane).toBe('template');
  });

  // The upload widget's own process step is what opens the editor; this flag
  // is the only thing that tells it the image is not a fresh import.
  it('marks the upload as an edit of something already stored', async () => {
    await viewModel.editGalleryImage(
      { name: PNG, label: 'photo.png' },
      'mailing',
      panel('mailing')
    );

    expect(added[0].data.editingExistingImage).toBe(true);
  });

  it('passes a real File carrying the fetched bytes', async () => {
    await viewModel.editGalleryImage(
      { name: JPG, label: 'photo.jpg' },
      'mailing',
      panel('mailing')
    );

    const [file] = added[0].data.files;
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/png');
    expect(file.size).toBeGreaterThan(0);
  });
});

describe('editGalleryImage — naming the copy', () => {
  // Editing can only ever add an entry: the stored name is the md5 of the
  // content and the server only pushes. Two entries under one label would be
  // indistinguishable in the grid and in a search.
  it('numbers the copy rather than reusing the original label', async () => {
    viewModel = makeViewModel([{ name: PNG, label: 'photo.png' }]);
    editImagePlugin(viewModel);

    await viewModel.editGalleryImage(
      { name: PNG, label: 'photo.png' },
      'mailing',
      panel('mailing')
    );

    expect(added[0].data.files[0].name).toBe('photo (2).png');
  });

  it('takes the next free number when copies already exist', async () => {
    viewModel = makeViewModel([
      { name: PNG, label: 'photo.png' },
      { name: 'x-2.png', label: 'photo (2).png' },
    ]);
    editImagePlugin(viewModel);

    await viewModel.editGalleryImage(
      { name: PNG, label: 'photo.png' },
      'mailing',
      panel('mailing')
    );

    expect(added[0].data.files[0].name).toBe('photo (3).png');
  });

  it('counts within the pane it writes to, not the other one', async () => {
    // The mailing pane already holds a (2); the template pane does not. If the
    // counting read the wrong pane (or both), the template copy would jump to
    // (3). It must stay (2). With both panes carrying the same labels the test
    // could not tell the two mistakes from the correct answer.
    viewModel = makeViewModel(
      [
        { name: PNG, label: 'photo.png' },
        { name: 'x-2.png', label: 'photo (2).png' },
      ],
      [{ name: 'y.png', label: 'photo.png' }]
    );
    editImagePlugin(viewModel);

    await viewModel.editGalleryImage(
      { name: 'y.png', label: 'photo.png' },
      'template',
      panel('template')
    );

    expect(added[0].data.files[0].name).toBe('photo (2).png');
  });

  // The pencil on an image block only knows the technical name. Naming the
  // copy after it would be a regression now that the gallery shows labels.
  it('names the copy after the label, even from the block pencil', async () => {
    viewModel = makeViewModel([{ name: PNG, label: 'mon visuel.png' }]);
    editImagePlugin(viewModel);

    await viewModel.editImage(
      () => `https://images.example.com/api/images/${PNG}`,
      panel('mailing')
    );

    expect(added[0].data.files[0].name).toBe('mon visuel (2).png');
  });

  // The bug that made the whole feature look broken: a label is free text, so
  // an image renamed to "clepsidre" has no extension. The copy inherited that,
  // and the upload it travels on cannot cope — `slugFilename` refuses such a
  // name, and the server threw where nobody could see it. No file, no error,
  // no response: the editor just appeared to save nothing.
  it('gives the copy an extension even when the label has none', async () => {
    viewModel = makeViewModel([{ name: PNG, label: 'clepsidre' }]);
    editImagePlugin(viewModel);

    await viewModel.editGalleryImage(
      { name: PNG, label: 'clepsidre' },
      'mailing',
      panel('mailing')
    );

    expect(added[0].data.files[0].name).toBe('clepsidre (2).png');
  });

  it('takes the extension from the stored file, not from the label', async () => {
    viewModel = makeViewModel([{ name: JPG, label: 'photo.png' }]);
    editImagePlugin(viewModel);

    await viewModel.editGalleryImage(
      { name: JPG, label: 'photo.png' },
      'mailing',
      panel('mailing')
    );

    // stored as .jpg, so the copy says .jpg — a label claiming otherwise
    // would describe a file that does not exist
    expect(added[0].data.files[0].name).toBe('photo (2).jpg');
  });

  // The gallery loads the first time it is opened, and the pencil is most
  // often used before that.
  it('names the copy after the label when the gallery was never opened', async () => {
    viewModel = makeViewModel(
      [
        { name: PNG, label: 'mon visuel.png' },
        { name: 'x-2.png', label: 'mon visuel (2).png' },
      ],
      [],
      { loaded: false }
    );
    editImagePlugin(viewModel);

    await viewModel.editImage(() => PNG, panel('mailing'));

    expect(added[0].data.files[0].name).toBe('mon visuel (3).png');
    expect(viewModel.loadedGallery).not.toHaveBeenCalledWith('template');
  });

  // an image dragged in from the template's gallery
  it('finds the label in the template gallery too', async () => {
    viewModel = makeViewModel([], [{ name: PNG, label: 'bandeau.png' }], {
      loaded: false,
    });
    editImagePlugin(viewModel);

    await viewModel.editImage(() => PNG, panel('mailing'));

    expect(added[0].data.files[0].name).toBe('bandeau (2).png');
  });

  it('falls back to the stored name when no gallery knows the image', async () => {
    await viewModel.editImage(() => PNG, panel('mailing'));

    expect(added[0].data.files[0].name).toBe(
      '507f1f77bcf86cd799439011-aaa (2).png'
    );
  });

  // the load already said it failed; the editor still opens
  it('still opens when a gallery cannot be loaded', async () => {
    viewModel.loadedGallery = jest.fn(() => Promise.resolve(null));

    const opened = await viewModel.editImage(() => PNG, panel('mailing'));

    expect(opened).toBe(true);
    expect(added[0].data.files[0].name).toBe(
      '507f1f77bcf86cd799439011-aaa (2).png'
    );
  });
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

  it('answers an empty string rather than throwing on nothing', () => {
    expect(storedNameOf(null)).toBe('');
    expect(storedNameOf(undefined)).toBe('');
  });
});

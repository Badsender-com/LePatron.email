/**
 * @jest-environment jsdom
 */
'use strict';

// Reopening the image editor on an image that is already stored: the
// handover — which widget, which bytes, under which name — and that an edit
// adds an entry rather than replacing one. What it refuses, and when, is in
// gallery-edit-image-refusals.test.js.
const editImagePlugin = require('../../packages/editor/src/js/ext/badsender-edit-image.js');
const {
  PNG,
  JPG,
  makeViewModel,
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

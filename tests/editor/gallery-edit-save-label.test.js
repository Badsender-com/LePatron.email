/**
 * @jest-environment jsdom
 */
'use strict';

// US-10 — the editor's save button.
//
// Reopening the editor on a stored image can only ever add a gallery entry:
// the stored name is the md5 of the content, and the server only pushes. So
// the button has to read "Save as a new file" there, and keep reading "Save"
// on an ordinary import — which is the distinction the product owner asked
// for, and the only thing standing between a user and the belief that their
// original has just been overwritten.

const $ = require('jquery');

jest.mock('../../packages/editor/src/js/bindings/image-editor', () => ({
  OpenEditor: jest.fn(),
}));

const {
  OpenEditor,
} = require('../../packages/editor/src/js/bindings/image-editor');

const MESSAGES = {
  upload: 'Enregistrer',
  upload_as_new: 'Enregistrer comme nouveau fichier',
  cancel: 'Annuler',
};

let cropImage;

beforeAll(() => {
  // The module registers itself as a blueimp widget extension on load. Catch
  // the definition instead of standing up the real widget.
  $.blueimp = { fileupload: {} };
  $.widget = (name, base, definition) => {
    cropImage = definition.processActions.cropImage;
  };
  // jsdom never loads an image, so `onload` would never fire and the editor
  // would never open.
  global.Image = class {
    set src(value) {
      this._src = value;
      setTimeout(() => this.onload && this.onload(), 0);
    }

    get src() {
      return this._src;
    }
  };

  require('../../packages/editor/src/js/bindings/badsender-fileupload-extension.js');
});

beforeEach(() => OpenEditor.mockClear());

// `cropImage` resolves only once the editor closes, which the mock never
// does; what matters is the arguments it opened with.
//
// Getting there takes two asynchronous hops — the FileReader's `load`, then
// the Image's — so the first version of this helper waited a single tick and
// read the previous test's call.
function openOn(file, extra = {}) {
  cropImage.call({}, { files: [file], index: 0, messages: MESSAGES, ...extra });
  return flush();
}

function flush(ticks = 10) {
  let chain = Promise.resolve();
  for (let i = 0; i < ticks; i++) {
    chain = chain.then(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  return chain;
}

const png = (name) =>
  new File([new Blob(['pixels'])], name, { type: 'image/png' });

const messagesOf = (call) => call[4];

describe('the editor save button', () => {
  it('says "save" on an ordinary import', async () => {
    await openOn(png('nouvelle image.png'));

    expect(OpenEditor).toHaveBeenCalledTimes(1);
    expect(messagesOf(OpenEditor.mock.calls[0]).upload).toBe('Enregistrer');
  });

  it('says "save as a new file" when reopened on a stored image', async () => {
    await openOn(png('photo (2).png'), { editingExistingImage: true });

    expect(OpenEditor).toHaveBeenCalledTimes(1);
    expect(messagesOf(OpenEditor.mock.calls[0]).upload).toBe(
      'Enregistrer comme nouveau fichier'
    );
  });

  // Swapping one entry must not drop the forty others the editor reads.
  it('leaves every other string of the editor untouched', async () => {
    await openOn(png('photo.png'), { editingExistingImage: true });

    const messages = messagesOf(OpenEditor.mock.calls[0]);
    expect(messages.cancel).toBe('Annuler');
    // and the original bag is not mutated for the next upload
    expect(MESSAGES.upload).toBe('Enregistrer');
  });
  // The hardcoded message bag in fileupload.js is incomplete, and a label
  // reading "undefined" is worse than one reading "Save".
  it('falls back to the plain label when the new key is missing', async () => {
    cropImage.call(
      {},
      {
        files: [png('photo.png')],
        index: 0,
        messages: { upload: 'Enregistrer' },
        editingExistingImage: true,
      }
    );
    await flush();

    expect(messagesOf(OpenEditor.mock.calls[0]).upload).toBe('Enregistrer');
  });
});

describe('what never reaches the editor', () => {
  // It flattens what it opens, so an animated GIF would come back as a single
  // still frame. The thumbnail hides its edit button for the same reason.
  it('skips a GIF entirely', async () => {
    await openOn(
      new File([new Blob(['x'])], 'anim.gif', { type: 'image/gif' })
    );

    expect(OpenEditor).not.toHaveBeenCalled();
  });

  it('skips an SVG entirely', async () => {
    await openOn(
      new File([new Blob(['<svg/>'])], 'logo.svg', { type: 'image/svg+xml' })
    );

    expect(OpenEditor).not.toHaveBeenCalled();
  });
});

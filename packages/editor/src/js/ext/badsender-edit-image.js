'use strict';

const $ = require('jquery');
const console = require('console');

const {
  labelForUpload,
  nextCopyLabel,
} = require('../../../../shared/gallery/label.js');
const { isEditableImage } = require('../../../../shared/gallery/filter.js');
const { mayDo } = require('./gallery-actions.js');
const { readStoredImage } = require('../vue/utils/apis');
const { GALLERY_REQUEST_TIMEOUT_MS } = require('./gallery-request.js');

// Reopening the image editor on an image that is already stored — from a
// gallery thumbnail and from the pencil on an image block, which has
// always done the same thing.
//
// Neither path talks to Konva. Both hand the stored bytes back to the upload
// widget that already owns the whole chain: its `cropImage` process step is
// what opens the editor, its save swaps the File in the queue, and its done
// handler pushes the result into the gallery observable. Everything
// downstream — the POST, the thumbnail, the Knockout array the rest of the
// editor reads — is the path an ordinary upload already takes, so none of it
// has to be rebuilt here or kept in step with itself.
//
// EDITING NEVER REPLACES THE ORIGINAL. The stored name is the md5 of the
// content and `addFiles` only ever `$push`es, so a save can only add an entry.
// That is the V1 decision rather than an accident: an image in the gallery may
// already be used by other emails, and overwriting it would change them all.
// The editor's save button says "Save as a new file" so the user is not
// promised otherwise, and the copy takes the next free number in its series.

// Mosaico's own extension point: defining `editImage` on the viewModel is what
// makes the pencil appear on an image block (tmpl/img-wysiwyg.tmpl.html). An
// image block can only ever upload to the mailing gallery.
const BLOCK_GALLERY_TYPE = 'mailing';
// where the pencil looks for the label of the image it edits, in this order
const GALLERY_TYPES = ['mailing', 'template'];

// The editor's canvas (bindings/image-editor.js): present while an editor is
// open, whose modal a second one would stack on.
const EDITOR_CANVAS_ID = 'konva-editor';

function editImagePlugin(viewModel) {
  const opening = createOpeningLock();

  /**
   * The pencil on an image already placed in the email.
   *
   * @param {Function} src knockout observable holding the image source
   * @param {HTMLElement} domElement the button that was clicked
   * @returns {Promise<boolean>} whether the editor opened
   */
  viewModel.editImage = function editImage(src, domElement) {
    return opening.run(domElement, () => {
      const storedName = storedNameOf(typeof src === 'function' ? src() : src);
      const input = findUploadInput(domElement);
      if (!mayOpenEditorOn(viewModel, BLOCK_GALLERY_TYPE, storedName, input)) {
        return false;
      }
      return labelOfStoredImage(viewModel, storedName).then((sourceLabel) =>
        handOver(viewModel, {
          input,
          storedName,
          type: BLOCK_GALLERY_TYPE,
          sourceLabel,
        })
      );
    });
  };

  /**
   * The same thing, from a gallery thumbnail.
   *
   * @param {object} file the gallery file, as the panel mirrors it
   * @param {string} type 'mailing' or 'template'
   * @param {HTMLElement} panelElement the Vue panel's root, to find its
   *   upload input: the two panes each have one, and only the element the
   *   click came from tells them apart
   * @param {HTMLElement} [trigger] the button clicked, marked busy meanwhile
   * @returns {Promise<boolean>} whether the editor opened
   */
  viewModel.editGalleryImage = function editGalleryImage(
    file,
    type,
    panelElement,
    trigger
  ) {
    return opening.run(trigger, () => {
      const input = findUploadInput(panelElement);
      if (!mayOpenEditorOn(viewModel, type, file.name, input)) return false;
      return handOver(viewModel, {
        input,
        storedName: file.name,
        type,
        sourceLabel: file.label || file.name,
      });
    });
  };
}

// Opening waits for up to two gallery loads and the read of the stored file,
// and ends in an editor that takes over a single global state: a second
// click during the wait opened a second editor over the first, whose save
// then acted on the other's state. One opening at a time, for the pencil and
// the thumbnails alike, and the clicked control says it is working on it,
// which is what the second click was asking.
function createOpeningLock() {
  let busy = false;
  return {
    run(trigger, open) {
      if (busy || document.getElementById(EDITOR_CANVAS_ID)) {
        return Promise.resolve(false);
      }
      busy = true;
      markBusy(trigger, true);
      return new Promise((resolve) => resolve(open())).finally(() => {
        busy = false;
        markBusy(trigger, false);
      });
    },
  };
}

function markBusy(element, busy) {
  if (!element || typeof element.setAttribute !== 'function') return;
  if (busy) element.setAttribute('aria-busy', 'true');
  else element.removeAttribute('aria-busy');
}

// Every reason not to open the editor, each one reported: a click that does
// nothing at all is the failure nobody can describe.
function mayOpenEditorOn(viewModel, type, storedName, input) {
  // Saving uploads a copy to the gallery (gallery-actions.js). The thumbnail
  // and the pencil are not drawn without the right; refusing here as well
  // means a new way in cannot open an editor whose save can only fail.
  if (!mayDo(viewModel, type, 'edit', 'gallery-edit-image-forbidden')) {
    return false;
  }

  // GIF and SVG never reach the editor: it flattens what it opens. The
  // thumbnail already hides its edit button for them, but the pencil on an
  // image block has no such guard — without this, editing a GIF there would
  // re-upload identical bytes, which the content-addressed name turns into a
  // silent no-op: the editor would seem not to open and nothing would appear.
  if (!isEditableImage({ name: storedName })) {
    viewModel.notifier.error(viewModel.t('gallery-edit-image-unsupported'));
    return false;
  }

  // the panel is open but its upload zone is not in the DOM
  if (!input || !input.length) {
    console.warn('[gallery] no upload input to open the image editor with');
    viewModel.notifier.error(viewModel.t('gallery-edit-image-fail'));
    return false;
  }
  return true;
}

function handOver(viewModel, { input, storedName, type, sourceLabel }) {
  // Through `labelForUpload` first, so the copy carries the extension of the
  // file it is a copy of. A label is free text — an image renamed to
  // "clepsidre" has no extension at all — and the upload the copy travels on
  // cannot cope with a name that has none: `slugFilename` answers `false` for
  // one, which the server then called `.replace` on. The exception landed
  // inside formidable's event handler, the request was never answered, and
  // the editor sat there having apparently saved nothing.
  const fileName = nextCopyLabel(
    labelForUpload(storedName, sourceLabel),
    labelsIn(viewModel, type)
  );

  // `fetch` has no timeout of its own, so a stalled read of the stored file
  // would hang the "edit" action with no feedback.
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    GALLERY_REQUEST_TIMEOUT_MS
  );

  // Same origin: the stored file is served by this application, whatever the
  // gallery list happens to carry as a display URL.
  return fetch(readStoredImage(storedName), {
    credentials: 'same-origin',
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .then((blob) => {
      input.fileupload('add', {
        files: [new File([blob], fileName, { type: blob.type })],
        // Blueimp merges whatever is handed to `add` into the options the
        // process queue sees, so this reaches the `cropImage` step — which
        // relabels the editor's save button with it.
        editingExistingImage: true,
      });
      return true;
    })
    .catch((error) => {
      console.error('[gallery] could not load the image for editing', error);
      viewModel.notifier.error(viewModel.t('gallery-edit-image-fail'));
      return false;
    })
    .finally(() => clearTimeout(timer));
}

// The upload widget lives in the `.uploadzone` of the gallery being written
// to, and there are two of them side by side — one per pane. The element the
// click came from is what tells them apart, which is the only reason this
// file touches the DOM at all.
//
// The pencil on an image block sits inside its upload zone; the Vue gallery
// panel is a sibling of one instead, so the panel is the fallback.
function findUploadInput(element) {
  if (!element) return null;
  const from = $(element);
  const zone = from.closest('.uploadzone');
  if (zone.length) return zone.find('input.fileupload').first();
  return from.closest('.gallery-panel').find('input.fileupload').first();
}

// An image block holds either a bare stored name or a full URL to one.
function storedNameOf(source) {
  const value = String(source || '');
  const path = value.split('?')[0];
  const segment = path.slice(path.lastIndexOf('/') + 1);
  // A `%` not followed by two hex digits (`remise-100%.png`, typed by hand in
  // a template) makes `decodeURIComponent` throw, inside a click handler and
  // before any message could be shown. Such a name was never encoded.
  try {
    return decodeURIComponent(segment);
  } catch (error) {
    return segment;
  }
}

function galleryOf(viewModel, type) {
  const observable = viewModel[`${type}Gallery`];
  return typeof observable === 'function' ? observable() : [];
}

function labelsIn(viewModel, type) {
  return galleryOf(viewModel, type).map((file) => file.label || file.name);
}

// The pencil knows only the stored name, and a copy named after it would read
// `507f…-a1b2 (2).png` in a gallery that shows labels. The label is kept in
// the gallery the image came from — the email's, or the template's for an
// image dragged from there — and a gallery is loaded only once its pane has
// been opened, which the pencil does not wait for. The stored name is unique:
// the first gallery holding it is the one.
function labelOfStoredImage(viewModel, storedName) {
  return GALLERY_TYPES.reduce(
    (search, type) =>
      search.then((found) => found || fileIn(viewModel, type, storedName)),
    Promise.resolve(null)
  ).then((found) => (found && found.label) || storedName);
}

function fileIn(viewModel, type, storedName) {
  const loaded =
    typeof viewModel.loadedGallery === 'function'
      ? viewModel.loadedGallery(type)
      : Promise.resolve(galleryOf(viewModel, type));
  return loaded.then((files) =>
    (files || []).find((file) => file.name === storedName)
  );
}

module.exports = editImagePlugin;
module.exports.storedNameOf = storedNameOf;

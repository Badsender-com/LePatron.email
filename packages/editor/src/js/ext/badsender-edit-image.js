'use strict';

const $ = require('jquery');
const console = require('console');

const {
  labelForUpload,
  nextCopyLabel,
} = require('../../../../shared/gallery/label.js');
const { isEditableImage } = require('../../../../shared/gallery/filter.js');

// Reopening the image editor on an image that is already stored — from a
// gallery thumbnail (US-10) and from the pencil on an image block, which has
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

function editImagePlugin(viewModel) {
  /**
   * The pencil on an image already placed in the email.
   *
   * @param {Function} src knockout observable holding the image source
   * @param {HTMLElement} domElement the button that was clicked
   * @returns {Promise<boolean>} whether the editor opened
   */
  viewModel.editImage = function editImage(src, domElement) {
    const storedName = storedNameOf(typeof src === 'function' ? src() : src);
    return openEditorOn(viewModel, {
      input: findUploadInput(domElement),
      storedName,
      type: BLOCK_GALLERY_TYPE,
      sourceLabel: labelInGallery(viewModel, BLOCK_GALLERY_TYPE, storedName),
    });
  };

  /**
   * US-10 — the same thing, from a gallery thumbnail.
   *
   * @param {object} file the gallery file, as the panel mirrors it
   * @param {string} type 'mailing' or 'template'
   * @param {HTMLElement} panelElement the Vue panel's root, to find its
   *   upload input: the two panes each have one, and only the element the
   *   click came from tells them apart
   * @returns {Promise<boolean>} whether the editor opened
   */
  viewModel.editGalleryImage = function editGalleryImage(
    file,
    type,
    panelElement
  ) {
    return openEditorOn(viewModel, {
      input: findUploadInput(panelElement),
      storedName: file.name,
      type,
      sourceLabel: file.label || file.name,
    });
  };
}

function openEditorOn(viewModel, { input, storedName, type, sourceLabel }) {
  // GIF and SVG never reach the editor: it flattens what it opens. The
  // thumbnail already hides its edit button for them, but the pencil on an
  // image block has no such guard — without this, editing a GIF there would
  // re-upload identical bytes, which the content-addressed name turns into a
  // silent no-op: the editor would seem not to open and nothing would appear.
  if (!isEditableImage({ name: storedName })) {
    viewModel.notifier.error(viewModel.t('gallery-edit-image-unsupported'));
    return Promise.resolve(false);
  }

  if (!input || !input.length) {
    // Nothing to hand the file to — the panel is open but its upload zone is
    // not in the DOM. Report it rather than failing silently on a click.
    console.warn('[gallery] no upload input to open the image editor with');
    viewModel.notifier.error(viewModel.t('gallery-edit-image-fail'));
    return Promise.resolve(false);
  }

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

  // Same origin: the stored file is served by this application, whatever the
  // gallery list happens to carry as a display URL.
  return fetch(`/api/images/${encodeURIComponent(storedName)}`, {
    credentials: 'same-origin',
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
    });
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
  return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
}

function galleryOf(viewModel, type) {
  const observable = viewModel[`${type}Gallery`];
  return typeof observable === 'function' ? observable() : [];
}

function labelsIn(viewModel, type) {
  return galleryOf(viewModel, type).map((file) => file.label || file.name);
}

// The block pencil only knows the technical name. Naming the copy after
// `507f…-a1b2.png` would be a regression now that the gallery shows labels, so
// the label of the image being edited is looked up where it is kept.
function labelInGallery(viewModel, type, storedName) {
  const found = galleryOf(viewModel, type).find(
    (file) => file.name === storedName
  );
  return (found && found.label) || storedName;
}

module.exports = editImagePlugin;
module.exports.storedNameOf = storedNameOf;

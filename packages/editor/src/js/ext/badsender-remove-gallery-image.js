'use strict';

const console = require('console');
const $ = require('jquery');
const {
  GALLERY_REQUEST_TIMEOUT_MS,
  timedOut,
  reloadAfterTimeout,
} = require('./gallery-request.js');
const { fillLabel } = require('../vue/utils/fill-label.js');

function removeGalleryImage(viewModel) {
  viewModel.removeImage = function removeImage(data, type) {
    // A bare window.confirm, the same stop sign this editor already puts in
    // front of deleting a comment and of discarding a block being built. It
    // guards the action rather than the button, so a second caller cannot
    // skip it by accident.
    //
    // It names the image: the button that opened it is one of three 24px
    // icons that appear under the pointer, and a mis-click is the whole
    // thing being guarded against. It also says what is NOT at stake —
    // deletion only removes the image from the gallery list, the stored file
    // stays where it is so emails already built with it keep working.
    const label = data.label || data.name;
    const question = fillLabel(
      viewModel.t('gallery-remove-image-confirm'),
      label
    );
    if (!window.confirm(question)) return;

    $.ajax({
      url: data.deleteUrl,
      // `type` is jQuery's older name for `method`, kept alongside it
      method: 'DELETE',
      type: 'DELETE',
      timeout: GALLERY_REQUEST_TIMEOUT_MS,
      success() {
        viewModel.notifier.success(viewModel.t('gallery-remove-image-success'));
        const gallery = viewModel[type + 'Gallery'];
        const status = viewModel[type + 'GalleryStatus'];
        // Just this one, not the whole array swapped for the server's copy:
        // that changed the identity of every file, which cancelled any rename
        // in flight and closed every open inline editor in the grid.
        const index = gallery().findIndex((file) => file.name === data.name);
        if (index !== -1) gallery.splice(index, 1);
        status(gallery().length);
      },
      error(jqXHR, textStatus) {
        console.error('gallery delete failed', jqXHR && jqXHR.status);
        if (timedOut(jqXHR, textStatus)) {
          reloadAfterTimeout(viewModel, type);
          return;
        }
        viewModel.notifier.error(viewModel.t('gallery-remove-image-fail'));
      },
    });
  };
}

module.exports = removeGalleryImage;

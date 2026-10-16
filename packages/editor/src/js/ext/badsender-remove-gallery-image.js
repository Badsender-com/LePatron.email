'use strict';

var console = require('console');
var $ = require('jquery');
const {
  GALLERY_REQUEST_TIMEOUT_MS,
  timedOut,
  reloadAfterTimeout,
} = require('./gallery-request.js');

function removeGalleryImage(viewModel) {
  viewModel.removeImage = function (data, type) {
    var deleteUrl = data.deleteUrl;

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
    var label = data.label || data.name;
    if (
      !window.confirm(viewModel.t('gallery-remove-image-confirm', { label }))
    ) {
      return;
    }

    $.ajax({
      url: deleteUrl,
      method: 'DELETE',
      // `type` options is an alias for `method` option.
      // Use `type` because `method` is not supported jQuery prior to 1.9.0.
      // actual bower version is 1.12.4 :(
      type: 'DELETE',
      timeout: GALLERY_REQUEST_TIMEOUT_MS,
      success: function (res) {
        viewModel.notifier.success(viewModel.t('gallery-remove-image-success'));
        var gallery = viewModel[type + 'Gallery'];
        var status = viewModel[type + 'GalleryStatus'];
        // Remove just this one instead of swapping the whole array for the
        // server's copy. Replacing it changed the identity of every file,
        // which cancelled any rename in flight and closed every open inline
        // editor in the grid — deleting one image should not disturb the rest.
        var current = gallery();
        var index = current.findIndex(function (f) {
          return f.name === data.name;
        });
        if (index !== -1) gallery.splice(index, 1);
        status(gallery().length);
      },
      error: function (jqXHR, textStatus) {
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

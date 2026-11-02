'use strict';

const console = require('console');
const $ = require('jquery');
const {
  GALLERY_REQUEST_TIMEOUT_MS,
  timedOut,
  reloadAfterTimeout,
} = require('./gallery-request.js');
const { removeByName } = require('./gallery-list.js');
const { mayDo } = require('./gallery-actions.js');
const { fillLabel } = require('../vue/utils/fill-label.js');

function removeGalleryImage(viewModel) {
  /**
   * @param {object} data the gallery file
   * @param {'mailing'|'template'} type which of the two galleries
   * @returns {Promise<boolean>} whether the image left the gallery
   */
  viewModel.removeImage = function removeImage(data, type) {
    // not even asked about when the server would refuse it
    if (!mayDo(viewModel, type, 'remove', 'gallery-remove-image-forbidden')) {
      return Promise.resolve(false);
    }

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
    if (!window.confirm(question)) return Promise.resolve(false);

    return new Promise((resolve) => sendDelete(viewModel, data, type, resolve));
  };
}

function sendDelete(viewModel, data, type, resolve) {
  $.ajax({
    url: data.deleteUrl,
    // `type` is jQuery's older name for `method`, kept alongside it
    method: 'DELETE',
    type: 'DELETE',
    timeout: GALLERY_REQUEST_TIMEOUT_MS,
    success() {
      viewModel.notifier.success(viewModel.t('gallery-remove-image-success'));
      // just this one, not the whole list reloaded (gallery-list.js)
      removeByName(
        viewModel[type + 'Gallery'],
        data.name,
        viewModel[type + 'GalleryStatus']
      );
      resolve(true);
    },
    error(jqXHR, textStatus) {
      console.error('gallery delete failed', jqXHR && jqXHR.status);
      resolve(false);
      if (timedOut(jqXHR, textStatus)) {
        reloadAfterTimeout(viewModel, type);
        return;
      }
      viewModel.notifier.error(viewModel.t('gallery-remove-image-fail'));
    },
  });
}

module.exports = removeGalleryImage;

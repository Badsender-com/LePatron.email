'use strict';

const $ = require('jquery');

const {
  sanitizeLabel,
} = require('../../../../shared/gallery/label.js');
const { renameGalleryImageLabel } = require('../vue/utils/apis');

// A gallery file is stored as `<mongoId>-<hash>.<ext>`: the prefix is the id of
// the mailing or template the gallery belongs to, which is what the route needs.
const MONGO_ID = /^([a-f\d]{24})-/;

function renameGalleryImage(viewModel) {
  /**
   * Rename what the user reads under a thumbnail. The technical file name never
   * moves — only this label, which is also what the search matches on.
   *
   * Optimistic: the new label is what the user just typed, so showing it before
   * the server confirms costs nothing, and a failure puts the old one back.
   *
   * @param {object} file the gallery file, as the grid holds it
   * @param {'mailing'|'template'} type which of the two galleries it belongs to
   * @param {string} rawLabel what the user typed
   * @returns {Promise<boolean>} whether the server accepted it
   */
  viewModel.renameImage = function renameImage(file, type, rawLabel) {
    const gallery = viewModel[type + 'Gallery'];
    const label = sanitizeLabel(rawLabel);
    const match = MONGO_ID.exec(file.name || '');

    if (!label || label === file.label || !match) return Promise.resolve(false);

    const index = gallery().findIndex((f) => f.name === file.name);
    if (index === -1) return Promise.resolve(false);
    const previous = gallery()[index];

    // Replace the entry instead of mutating it: Knockout notifies on array
    // operations, not on a property of an element, and the Vue grid mirrors
    // this array. Same `name`, so the virtual scroller keeps the same view.
    gallery.splice(index, 1, Object.assign({}, previous, { label: label }));

    return $.ajax({
      url: renameGalleryImageLabel(match[1], file.name),
      method: 'PATCH',
      type: 'PATCH',
      contentType: 'application/json',
      data: JSON.stringify({ label: label }),
    })
      .then(function onAccepted() {
        return true;
      })
      .catch(function onRefused() {
        // put back exactly what was there, by name: the array may have moved
        // under us while the request was in flight
        const current = gallery().findIndex((f) => f.name === file.name);
        if (current !== -1) gallery.splice(current, 1, previous);
        viewModel.notifier.error(viewModel.t('gallery-rename-image-fail'));
        return false;
      });
  };
}

module.exports = renameGalleryImage;

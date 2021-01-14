'use strict';

var console = require('console');
var $ = require('jquery');
var ko = require('knockout');

function removeGalleryImage(viewModel) {
  viewModel.removeImage = function (data, type, event) {
    var deleteUrl = data.deleteUrl;

    $.ajax({
      url: deleteUrl,
      method: 'DELETE',
      // `type` options is an alias for `method` option.
      // Use `type` because `method` is not supported jQuery prior to 1.9.0.
      // actual bower version is 1.12.4 :(
      type: 'DELETE',
      success: function (res) {
        viewModel.notifier.success(viewModel.t('gallery-remove-image-success'));
        var gallery = viewModel[type + 'Gallery'];
        var status = viewModel[type + 'GalleryStatus'];
        status(res.files.length);
        gallery(res.files.reverse());
      },
      error: function (err) {
        console.log(err);
        viewModel.notifier.error(viewModel.t('gallery-remove-image-fail'));
      },
    });
  };
}

module.exports = removeGalleryImage;

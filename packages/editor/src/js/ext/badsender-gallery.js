'use strict';

const $ = require('jquery');
const ko = require('knockout');
const _find = require('lodash.find');

function galleryLoader(opts) {
  var galleryUrl = opts.fileuploadConfig.url;

  return function (viewModel) {
    viewModel.mailingGallery = ko.observableArray([]);
    viewModel.templateGallery = ko.observableArray([]);
    viewModel.mailingGalleryStatus = ko.observable(false);
    viewModel.templateGalleryStatus = ko.observable(false);

    function loadGallery(type) {
      var url = galleryUrl[type];
      var gallery = viewModel[type + 'Gallery'];
      var status = viewModel[type + 'GalleryStatus'];
      return function () {
        status('loading');
        // retrieve the full list of remote files
        $.getJSON(url, function (data) {
          for (var i = 0; i < data.files.length; i++)
            data.files[i] = viewModel.remoteFileProcessor(data.files[i]);
          status(data.files.length);
          gallery(data.files.reverse());
        }).fail(function () {
          status(false);
          viewModel.notifier.error(
            viewModel.t('Unexpected error listing files')
          );
        });
      };
    }

    // this is used as a parameter in fileupload binding
    // see toolbox.tmpl.html `#toolimagesgallery fileupload`
    // fileupload binding will iterate on every uploaded file and call this callback
    // fileupload.js => e.type == 'fileuploaddone' for more details
    function loadImage(type) {
      console.log("load Image")
      var gallery = viewModel[type + 'Gallery'];
      var status = viewModel[type + 'GalleryStatus'];
      return function (img) {
        var imageName = img.name;
        // call gallery(), because it is a knockout observable and not a real array
        // Don't show twice the same image
        var isAlreadyUploaded = _find(gallery(), function (file) {
          return file.name === imageName;
        });
        if (isAlreadyUploaded)  { console.log('is Already uploaded') ; return;}
        // Don't update the gallery until it has been opened once
        // This was leading to preventing the whole gallery to be fetched…
        // …if we had uploaded an image in the editor
        if (status() === false)  { console.log('status is false') ; return;};
        gallery.unshift(img);
        status(gallery().length);
      };
    }

    viewModel.loadMailingGallery = loadGallery('mailing');
    viewModel.loadTemplateGallery = loadGallery('template');
    viewModel.loadMailingImage = loadImage('mailing');
    viewModel.loadTemplateImage = loadImage('template');

    const galleryOpen = viewModel.showGallery.subscribe((newValue) => {
      if (newValue === true && viewModel.mailingGalleryStatus() === false) {
        viewModel.loadMailingGallery();
        galleryOpen.dispose();
      }
    });

    const tabChange = viewModel.selectedImageTab.subscribe(
      (newValue) => {
        if (newValue === 1 && viewModel.templateGalleryStatus() === false) {
          viewModel.loadTemplateGallery();
          tabChange.dispose();
        }
      },
      viewModel,
      'change'
    );
  };
}

module.exports = galleryLoader;

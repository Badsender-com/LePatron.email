'use strict';

const $ = require('jquery');
const ko = require('knockout');
const _find = require('lodash.find');

// Same budget as the rename and delete calls. A list fetch with no ceiling can
// strand the panel on "loading…" indefinitely.
const LOAD_TIMEOUT_MS = 15000;

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
        // `$.ajax` rather than `$.getJSON`, only to carry a timeout: a stalled
        // list fetch would otherwise leave the panel stuck on "loading…"
        // forever, with no error and no way back.
        $.ajax({ url: url, dataType: 'json', timeout: LOAD_TIMEOUT_MS })
          .done(function (data) {
            for (var i = 0; i < data.files.length; i++)
              data.files[i] = viewModel.remoteFileProcessor(data.files[i]);
            // the list before the status: whoever waits on the status
            // (`loadedGallery`) reads the list as soon as it changes
            gallery(data.files.reverse());
            status(data.files.length);
          })
          .fail(function () {
            // back to `false`, so the "Load gallery" button returns and the
            // user can retry rather than being stranded on "loading…".
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
      var gallery = viewModel[type + 'Gallery'];
      var status = viewModel[type + 'GalleryStatus'];
      return function (img) {
        var imageName = img.name;
        // call gallery(), because it is a knockout observable and not a real array
        // Don't show twice the same image
        var isAlreadyUploaded = _find(gallery(), function (file) {
          return file.name === imageName;
        });
        if (isAlreadyUploaded) return;
        // Don't update the gallery until it has been opened once
        // This was leading to preventing the whole gallery to be fetched…
        // …if we had uploaded an image in the editor
        if (status() === false) return;
        gallery.unshift(img);
        status(gallery().length);
      };
    }

    var loaders = {
      mailing: loadGallery('mailing'),
      template: loadGallery('template'),
    };
    viewModel.loadMailingGallery = loaders.mailing;
    viewModel.loadTemplateGallery = loaders.template;

    // The list of a gallery once it is loaded: at once when it is, after the
    // load under way, or after starting one. A gallery loads the first time
    // its pane opens, and some callers (the pencil on an image of the email)
    // need it before that. `null` when the load fails, which the loader has
    // already reported.
    viewModel.loadedGallery = function (type) {
      var gallery = viewModel[type + 'Gallery'];
      var status = viewModel[type + 'GalleryStatus'];
      if (typeof status() === 'number') return Promise.resolve(gallery());
      return new Promise(function (resolve) {
        var settled = status.subscribe(function (value) {
          if (value === 'loading') return;
          settled.dispose();
          resolve(typeof value === 'number' ? gallery() : null);
        });
        if (status() === false) loaders[type]();
      });
    };
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

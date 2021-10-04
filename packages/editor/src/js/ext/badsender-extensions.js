'use strict';

var ko = require('knockout');
var url = require('url');
var slugFilename = require('../../../../server/helpers/slug-filename.js');

// https://github.com/voidlabs/mosaico/wiki/Mosaico-Plugins

//////
// VIEW-MODEL PLUGINS
//////

const badsenderEventsHub = require('../badsender-events-hub.js');
const serverStorage = require('./badsender-server-storage');
const editTitle = require('./badsender-edit-title');
const gallery = require('./badsender-gallery');
const removeImage = require('./badsender-remove-gallery-image');
const espProfiles = require('./badsender-esp-profiles');
const extendTinyMce = require('./badsender-extend-tinymce');
const extendTextEditor = require('./badsender-extend-text-editor');
const colorPicker = require('./badsender-color-picker');
const selectItem = require('./badsender-select-item.js');
const screenPreview = require('./badsender-screen-preview.js');

// widgets
// https://github.com/voidlabs/mosaico/wiki/Mosaico-Plugins#widget-plugins
var widgetBgImage = require('./badsender-widget-bgimage');

function editorIcon(opts) {
  const { editorIcon } = opts.metadata;
  return function setEditorIcon(viewModel) {
    viewModel.logoPath = editorIcon.logoPath;
    viewModel.logoUrl = editorIcon.logoUrl;
    viewModel.logoAlt = editorIcon.logoAlt;
  };
}

function downloadOptions(opts) {
  return function setDownloadOptions(viewModel) {
    viewModel.downloadCdn = opts.download.cdnImages;
    viewModel.cdnButtonLabel = opts.download.cdnButtonLabel;
    viewModel.downloadFtp = opts.download.ftpImages;
    viewModel.ftpButtonLabel = opts.download.ftpButtonLabel;
  };
}

function extendViewModel(opts, customExtensions) {
  customExtensions.push(serverStorage(opts));
  customExtensions.push(editorIcon(opts));
  customExtensions.push(editTitle);
  customExtensions.push(gallery(opts));
  customExtensions.push(colorPicker(opts));
  customExtensions.push(extendTextEditor(opts));
  customExtensions.push(espProfiles(opts));
  customExtensions.push(removeImage);
  customExtensions.push(extendTinyMce);
  customExtensions.push(downloadOptions(opts));
  customExtensions.push(screenPreview);
  // widget should be differentiating of VM extensions by
  // template-loader.js#pluginsCall
  customExtensions.push(widgetBgImage(opts));
  // fix duplicated blocks items
  customExtensions.push(selectItem);

  // we need to expose the eventHub to knockout
  // • we will dispatch some events from the knockout templates
  customExtensions.push(badsenderEventsHub.exposeToKnockout);
  // expose view-model on dev only
  if (process.env.NODE_ENV === `development`) {
    customExtensions.push(function exposeViewModel(vm) {
      window._viewModel = vm;
    });
  }
}

//////
// KNOCKOUT EXTEND
//////

function templateUrlConverter(opts) {
  const assets = opts.metadata.assets || {};
  // options have been set in the editor template
  const imagesUrl = opts.metadata.imagesUrl;
  return function badsenderTemplateUrlConverter(url) {
    if (!url) return null;
    // handle: [unsubscribe_link] or mailto:[mail]
    if (/\]$/.test(url)) return null;
    // handle absolute url: http
    if (/^http/.test(url)) return null;
    // handle ESP tags: in URL <%
    if (/<%/.test(url)) return null;
    // handle other urls: img/social_def/twitter_ok.png
    const urlRegexp = /([^\/]*)$/;
    const extensionRegexp = /\.[0-9a-z]+$/;
    // as it is done, all files are flatten in asset folder (uploads or S3)
    url = urlRegexp.exec(url)[1];
    // handle every other case:
    //   *|UNSUBSCRIBE|*
    //   #UNSUBSCRIBE
    if (!extensionRegexp.test(url)) return null;
    // All images at uploaded are renamed with md5
    //    block thumbnails are based on html block ID
    //    => we need to maintain a dictionary of name -> md5 name
    //    here come the assets block
    // we still keep the slug part for backward compatibility reason with old image name conventions
    url = slugFilename(url);
    url = assets[url] ? imagesUrl.images + assets[url] : null;
    return url;
  };
}

// knockout is a global object.
// So we can extend it easily

// this equivalent to the original app.js#applyBindingOptions
function extendKnockout(opts) {
  //----- TINYMCE

  // Change tinyMCE full editor options
  if (opts.lang === 'fr') {
    tinymce.util.I18n.add('fr_FR', {
      Cancel: 'Annuler',
      'in pixel': 'en pixel',
      'Enter a font-size': 'Entrez une taille de police',
      'Letter spacing': 'Interlettrage',
      'Font size': 'Taille de police',
      'Font size: ': 'Taille : ',
      'minimum size: 8px': 'taille minimum : 8px',
      'no decimals': 'pas de décimales',
    });
  }
  //----- URLS HANDLING

  // This is not used by knockout per se.
  // Store this function in KO global object so it can be accessed by template-loader.js#templateLoader
  // badsenderTemplateUrlConverter is used:
  //  - for preview images on left bar
  //  - for static links in templates
  ko.bindingHandlers.wysiwygSrc.templateUrlConverter = templateUrlConverter(
    opts
  );

  // options have been set in the editor template
  const imagesUrl = Object.freeze(opts.metadata.imagesUrl);
  const imgProcessorBackend = url.parse(imagesUrl.images);

  // send the non-resized image url
  ko.bindingHandlers.fileupload.remoteFilePreprocessor = function (file) {
    console.info('REMOTE FILE PREPROCESSOR');
    console.log(file);
    var fileUrl = url.format({
      protocol: imgProcessorBackend.protocol,
      host: imgProcessorBackend.host,
      pathname: imgProcessorBackend.pathname,
    });
    file.url = url.resolve(fileUrl, url.parse(file.url).pathname);
    return file;
  };

  function getSafeSizes(width, height) {
    width = parseInt(width, 10);
    height = parseInt(height, 10);
    width = isFinite(width) ? width : null;
    height = isFinite(height) ? height : null;
    return `${width}x${height}`;
  }
  // push "convertedUrl" method to the wysiwygSrc binding
  const PATH_REGEX = /\/?([^\/]*)$/;
  const ALLOWED_METHODS = [`cover`, `crop`];
  ko.bindingHandlers.wysiwygSrc.convertedUrl = function (
    src,
    method,
    width,
    height
  ) {
    const imageName = url.parse(src).pathname;
    if (!imageName) console.warn('no pathname for image', src);
    method = ALLOWED_METHODS.includes(method) ? method : ALLOWED_METHODS[0];
    const regexResult = PATH_REGEX.exec(imageName);
    if (!regexResult) return;
    const { 1: fileName } = regexResult;
    console.info('CONVERTED URL', fileName, method, width, height);
    return `${imagesUrl[method]}${getSafeSizes(width, height)}/${fileName}`;
  };

  ko.bindingHandlers.wysiwygSrc.placeholderUrl = function (
    width,
    height,
    text
  ) {
    return `${imagesUrl.placeholder}${getSafeSizes(width, height)}.png`;
  };
}

module.exports = {
  extendViewModel: extendViewModel,
  extendKnockout: extendKnockout,
};

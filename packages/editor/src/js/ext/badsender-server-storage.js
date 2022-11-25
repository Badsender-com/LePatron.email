'use strict';

var console = require('console');
var $ = require('jquery');
var ko = require('knockout');
var _omit = require('lodash.omit');
var isEmail = require('validator/lib/isEmail');

function getData(viewModel) {
  // gather meta
  // remove keys that aren't necessary to update
  var datas = _omit(ko.toJS(viewModel.metadata), ['urlConverter', 'template']);
  datas.data = viewModel.exportJS();
  return datas;
}

function getErrorsForControlQuality(html) {
  return $(html).find('a[href="#toreplace"]');
}

function loader(opts) {
  var updateRoute = opts.metadata.url.update;
  return function (viewModel) {
    console.info('init server storage (save, test, download)');
    //////
    // SAVE
    //////

    var saveCmd = {
      name: 'Save', // l10n happens in the template
      enabled: ko.observable(true),
    };

    saveCmd.execute = function () {
      saveCmd.enabled(false);
      var data = getData(viewModel);

      data = {
        ...data,
        htmlToExport: viewModel.exportHTML()
      };
      // force JSON for bodyparser to catch up
      // => keep types server side
      $.ajax({
        url: updateRoute,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: onPostSuccess,
        error: onPostError,
        complete: onPostComplete,
      });

      // use callback for easier jQuery updates
      // => Deprecation notice for .success(), .error(), and .complete()
      function onPostSuccess(data, textStatus, jqXHR) {
        viewModel.notifier.success(viewModel.t('save-message-success'));
      }

      function onPostError(jqXHR, textStatus, errorThrown) {
        console.log('save error');
        console.log(errorThrown);
        viewModel.notifier.error(viewModel.t('save-message-error'));
      }

      function onPostComplete() {
        saveCmd.enabled(true);
      }
    };





    //////
    // EMAIL
    //////

    var testCmd = {
      name: 'Test', // l10n happens in the template
      enabled: ko.observable(true),
    };
    testCmd.execute = function () {
      viewModel.openTestModal(true);
    };

    //////
    // ZIP
    //////

    // Download markup can be found in:
    // • tmpl-badsender/download-buttons.tmpl.html

    // Download local/FTP button
    const downloadCmd = {
      name: `Download`, // l10n happens in the template
      enabled: ko.observable(true),
    };
    const dlDefault = { forCdn: false, forFtp: false };
    downloadCmd.execute = function downloadMail(downloadOptions = dlDefault) {
      console.info('DOWNLOAD ????', downloadOptions);
      const htmlToExport = viewModel.exportHTML();
      console.log({ htmlToExport });

      const splittedHtml = htmlToExport.split('\n');
      console.log({ splittedHtml });

      const $errorMessageDiv = $('<div class="error-message"></div>');
      $errorMessageDiv.insertBefore('replacedbody');

      const $errorMessageTitle = $(`<h3>${viewModel.t(`Error message`)}</h3>`);
      $errorMessageDiv.append($errorMessageTitle);

      const $errorsDiv = $('<ul><li>First</li><li>Second</li></ul>');
      const parsedHtml = $.parseHTML(htmlToExport);
      console.log({ parsedHtml });
      console.log({ $errorMessageDiv});
      const errors = getErrorsForControlQuality(parsedHtml);
      console.log({errors});
      $errorMessageDiv.append($errorsDiv);

      const $inputHiddenCdnStatus = $(`input[name="downLoadForCdn"]`),
        $inputHiddenFtpStatus = $(`input[name="downLoadForFtp"]`);

      downloadCmd.enabled(false);

      viewModel.notifier.info(viewModel.t(`Downloading...`));
      viewModel.exportHTMLtoTextarea(`#downloadHtmlTextarea`);
      $(`#downloadHtmlFilename`).val(viewModel.metadata.name());
      $inputHiddenCdnStatus.val(downloadOptions.forCdn);
      $inputHiddenFtpStatus.val(downloadOptions.forFtp);
      $(`#downloadForm`).attr(`action`, viewModel.metadata.url.zip).submit();
      downloadCmd.enabled(true);
    };

    viewModel.save = saveCmd;
    viewModel.test = testCmd;
    viewModel.download = downloadCmd;
  };
}

module.exports = loader;

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
      console.info('SAVE DATA');
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
        console.log('save success');
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

    // If the mail doesn't have preview contain then execute the request for the first time the save mail and generate preview
    if(!opts.metadata.hasHtmlPreview) {
      saveCmd.execute();
    }

    //////
    // EMAIL
    //////

    var testCmd = {
      name: 'Test', // l10n happens in the template
      enabled: ko.observable(true),
    };
    testCmd.execute = function () {
      console.info('TEST');
      console.log(viewModel.metadata.url.send);
      testCmd.enabled(false);
      var email = viewModel.t('Insert here the recipient email address');
      email = global.prompt(viewModel.t('Test email address'), email);

      // Don't validate `null` values => isEmail will error
      if (!email) return testCmd.enabled(true);

      const emails = email.split(";");
      for (const address of emails){
        if (!isEmail(address)) {
          global.alert(viewModel.t('Invalid email address'));
          return testCmd.enabled(true);
        }
      }

      console.log('TODO testing...', email);
      var metadata = ko.toJS(viewModel.metadata);
      var datas = {
        rcpt: email,
        html: viewModel.exportHTML(),
      };
      $.ajax({
        url: viewModel.metadata.url.send,
        method: 'POST',
        data: datas,
        success: onTestSuccess,
        error: onTestError,
        complete: onTestComplete,
      });

      function onTestSuccess(data, textStatus, jqXHR) {
        console.log('test success');
        viewModel.notifier.success(viewModel.t('Test email sent...'));
      }

      function onTestError(jqXHR, textStatus, errorThrown) {
        console.log('test error');
        console.log(errorThrown);
        viewModel.notifier.error(
          viewModel.t('Unexpected error talking to server: contact us!')
        );
      }

      function onTestComplete() {
        testCmd.enabled(true);
      }
    };

    //////
    // ZIP
    //////

    // Download markup can be found in:
    // • tmpl-badsender/download-buttons.tmpl.html

    const downloadCmd = {
      name: `Download`, // l10n happens in the template
      enabled: ko.observable(true),
    };
    const dlDefault = { forCdn: false, forFtp: false };
    downloadCmd.execute = function downloadMail(downloadOptions = dlDefault) {
      console.info('DOWNLOAD', downloadOptions);
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

'use strict';
import _ from 'lodash';

const console = require('console');
const $ = require('jquery');
const ko = require('knockout');
const _omit = require('lodash.omit');
const { getErrorsForControlQuality, displayErrors } = require('../ext/badsender-control-quality');

function getData(viewModel) {
  // gather meta
  // remove keys that aren't necessary to update
  const datas = _omit(ko.toJS(viewModel.metadata), ['urlConverter', 'template']);
  datas.data = viewModel.exportJS();
  return datas;
}

function loader(opts) {
  const updateRoute = opts.metadata.url.update;
  return function (viewModel) {
    console.info('init server storage (save, test, download)');
    /// ///
    // SAVE
    /// ///
    const saveCmd = {
      name: 'Save', // l10n happens in the template
      enabled: ko.observable(true),
    };

    saveCmd.execute = function () {
      saveCmd.enabled(false);
      let data = getData(viewModel);

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

    /// ///
    // EMAIL
    /// ///
    const testCmd = {
      name: 'Test', // l10n happens in the template
      enabled: ko.observable(true),
    };
    testCmd.execute = function () {
      viewModel.openTestModal(true);
    };

    /// ///
    // ZIP
    /// ///

    // Download markup can be found in:
    // • tmpl-badsender/download-buttons.tmpl.html

    // Download local/FTP button
    const downloadCmd = {
      name: 'Download', // l10n happens in the template
      enabled: ko.observable(true),
    };

    const dlDefault = { forCdn: false, forFtp: false };
    downloadCmd.execute = function downloadMail(downloadOptions = dlDefault) {
      // ====================================
      // Check for missing input values
      const errors = getErrorsForControlQuality(viewModel);
      if (errors && errors.length > 0) {
        displayErrors(errors, viewModel);
        // Scroll to top so the user can see warnings if there is any
        document.getElementById('main-wysiwyg-area').scrollTo({
          behavior: 'smooth',
          top: 0,
        })
      } else {
        $('.error-message').remove();
      }

      downloadCmd.enabled(false);

      viewModel.notifier.info(viewModel.t('Downloading...'));

      $.ajax({
        url: viewModel.metadata.url.zip,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          html: viewModel.exportHTML(),
          filename: viewModel.metadata.name(),
          downLoadForCdn: downloadOptions.forCdn,
          downLoadForFtp: downloadOptions.forFtp,
        }),
        xhrFields: { responseType: 'blob' },
        success: function(blob) {
          var url = window.URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = viewModel.metadata.name() + '.zip';
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        },
        error: function() {
          viewModel.notifier.error(viewModel.t('download-ftp-error'));
        },
        complete: function() {
          downloadCmd.enabled(true);
        },
      });
    };

    viewModel.save = saveCmd;
    viewModel.test = testCmd;
    viewModel.download = downloadCmd;
  };
}

module.exports = loader;

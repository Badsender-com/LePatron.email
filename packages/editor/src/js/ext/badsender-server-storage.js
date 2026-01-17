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

    const dlDefault = { forCdn: false, forFtp: false, exportProfileId: null };
    downloadCmd.execute = function downloadMail(downloadOptions = dlDefault) {
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

      // Check if this is an export profile with ESP delivery
      if (downloadOptions.exportProfileId) {
        const exportProfiles = viewModel.exportProfiles();
        const exportProfile = exportProfiles.find(
          (ep) => ep.id === downloadOptions.exportProfileId
        );

        if (exportProfile && exportProfile.deliveryMethod === 'esp') {
          // ESP delivery - use AJAX and show notification
          viewModel.notifier.info(viewModel.t('Sending to ESP...'));
          viewModel.exportHTMLtoTextarea('#downloadHtmlTextarea');
          const html = $('#downloadHtmlTextarea').val();

          $.ajax({
            url: viewModel.metadata.url.zip,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
              html,
              exportProfileId: downloadOptions.exportProfileId,
              downLoadForCdn: false,
              downLoadForFtp: false,
            }),
            success: function (data) {
              if (data.success) {
                viewModel.notifier.success(
                  viewModel.t('ESP send success') + (data.campaignId ? ' (ID: ' + data.campaignId + ')' : '')
                );
              } else {
                viewModel.notifier.error(data.message || viewModel.t('ESP send error'));
              }
            },
            error: function (jqXHR) {
              const errorData = jqXHR.responseJSON || {};
              viewModel.notifier.error(
                errorData.message || errorData.error || viewModel.t('ESP send error')
              );
            },
            complete: function () {
              downloadCmd.enabled(true);
            },
          });
          return;
        }
      }

      // Download delivery (legacy or export profile) - use form submit
      const $inputHiddenCdnStatus = $('input[name="downLoadForCdn"]');
      const $inputHiddenFtpStatus = $('input[name="downLoadForFtp"]');
      const $inputHiddenExportProfileId = $('input[name="exportProfileId"]');

      viewModel.notifier.info(viewModel.t('Downloading...'));
      viewModel.exportHTMLtoTextarea('#downloadHtmlTextarea');
      $('#downloadHtmlFilename').val(viewModel.metadata.name());
      $inputHiddenCdnStatus.val(downloadOptions.forCdn || false);
      $inputHiddenFtpStatus.val(downloadOptions.forFtp || false);
      $inputHiddenExportProfileId.val(downloadOptions.exportProfileId || '');
      $('#downloadForm').attr('action', viewModel.metadata.url.zip).submit();
      downloadCmd.enabled(true);
    };

    viewModel.save = saveCmd;
    viewModel.test = testCmd;
    viewModel.download = downloadCmd;
  };
}

module.exports = loader;

'use strict';
import _ from 'lodash';

const console = require('console');
const $ = require('jquery');
const ko = require('knockout');
const _omit = require('lodash.omit');

function getData(viewModel) {
  // gather meta
  // remove keys that aren't necessary to update
  const datas = _omit(ko.toJS(viewModel.metadata), ['urlConverter', 'template']);
  datas.data = viewModel.exportJS();
  return datas;
}

function formatBlockName(blockName) {
  return _.startCase(blockName.replace('Block', ''))
}

// return missing required errors if needed
function getErrorsForControlQuality(viewModel) {
  const htmlToExport = viewModel.exportHTML()
  const parsedHtml = $.parseHTML(htmlToExport);
  const itemsForBackgroundImage = viewModel?.content()?.mainBlocks()?.blocks()
    .filter(block => block()?.bgOptions()?.bgimage() === '' || block()?.bgOptions()?.bgimage() === 'none' || block()?.bgOptions()?.bgimage() === 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==')
    .map(block => `Block ${formatBlockName(block().type())} - ${viewModel.t('Missing background image')}`);

  const itemsForLinks = $(parsedHtml)
    .find('a[href="#toreplace"]')
    .toArray()
    .map(e => `${e.textContent?.trim() ? `${viewModel.t('Missing link label:')} ${e.textContent?.trim()}` : viewModel.t('Picture with no link')}`);

  return itemsForBackgroundImage.concat(itemsForLinks);
}

function displayErrors (errors, viewModel) {
  $('.error-message').remove();

  const $errorMessageTitle = $(`<h3>${viewModel.t('Your email was successfully exported')}</h3>`);
  const $errorMessageDescription = $(`<p>${viewModel.t('We noticed some missing details while executing quality controls:')}</p>`);
  const $errorLines = errors.map(error => $(`<li>${error}</li>`));
  const $errorsDiv = $('<ul></ul>').append($errorLines);

  const $errorMessageDiv = $('<div class="error-message"></div>');
  $errorMessageDiv.insertBefore('replacedbody');
  $errorMessageDiv.append($errorMessageTitle, $errorMessageDescription, $errorsDiv);
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

      const $inputHiddenCdnStatus = $('input[name="downLoadForCdn"]');
      const $inputHiddenFtpStatus = $('input[name="downLoadForFtp"]');

      downloadCmd.enabled(false);

      viewModel.notifier.info(viewModel.t('Downloading...'));
      viewModel.exportHTMLtoTextarea('#downloadHtmlTextarea');
      $('#downloadHtmlFilename').val(viewModel.metadata.name());
      $inputHiddenCdnStatus.val(downloadOptions.forCdn);
      $inputHiddenFtpStatus.val(downloadOptions.forFtp);
      $('#downloadForm').attr('action', viewModel.metadata.url.zip).submit();
      downloadCmd.enabled(true);
    };

    viewModel.save = saveCmd;
    viewModel.test = testCmd;
    viewModel.download = downloadCmd;
  };
}

module.exports = loader;

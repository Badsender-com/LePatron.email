const _ = require('lodash');
const $ = require('jquery');

function formatBlockName(blockName) {
  return _.startCase(blockName.replace('Block', ''))
}

function getAlertText(blockName, type, missingText) {
  return `Block ${blockName} ${type} - ${missingText}`
}

function isElementEmpty(element) {
  const imageEmpty = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  const pngEmpty = 'https://live.lepatron.email/clarins/mastertemplate/bg.png';
  return element === null || element === '' || element === 'none' || element === imageEmpty || element === pngEmpty;
}

function getErrorsForControlQuality(viewModel) {
  const htmlToExport = viewModel.exportHTML()
  const parsedHtml = $.parseHTML(htmlToExport);
  const extraItems = [];
  const itemsForBackgroundImage = viewModel?.content()?.mainBlocks()?.blocks()
    .filter(block => {
      if (block()?.bgOptions &&
          block()?.bgOptions()?.outlookBgImageVisible &&
          block()?.bgOptions()?.outlookBgImage
        ) {
        if (block()?.bgOptions()?.outlookBgImageVisible()) {
          const hasAlert = isElementEmpty(block()?.bgOptions()?.outlookBgImage());
          if (hasAlert) {
            return true;
          }
        }
      }
      if (block()?.bgOptions &&
          block()?.bgOptions()?.mobileBgImageChoice &&
          block()?.bgOptions()?.mobileBgimage
        ) {
        if (block()?.bgOptions()?.mobileBgImageChoice() === 'mobile') {
          const hasAlert = isElementEmpty(block()?.bgOptions()?.mobileBgimage());
          if (hasAlert) {
            return true;
          }
        }
      }
      if (block()?.bgOptions &&
          (block()?.bgOptions()?.bgImageChoice || block()?.bgOptions()?.bgImageVisible) &&
          block()?.bgOptions()?.bgimage
        ) {
        if (block()?.bgOptions()?.bgImageChoice && block()?.bgOptions()?.bgImageChoice() === 'custom' ||
          block()?.bgOptions()?.bgImageVisible && block()?.bgOptions()?.bgImageVisible()
        ) {
          const hasAlert = isElementEmpty(block()?.bgOptions()?.bgimage());
          if (hasAlert) {
            return true;
          }
        }
      }

      return false;
    })
    .map(block => {
      if (block()?.bgOptions) {
        if (block()?.bgOptions()?.outlookBgImageVisible && block()?.bgOptions()?.outlookBgImageVisible()) {
          const hasToAddNewItem = isElementEmpty(block()?.bgOptions()?.outlookBgImage());
          if (hasToAddNewItem) {
            extraItems.push(getAlertText(formatBlockName(block().type()), 'Outlook', viewModel.t('Missing background image')));
          }
        }
        if (block()?.bgOptions()?.mobileBgImageChoice && block()?.bgOptions()?.mobileBgImageChoice() === 'mobile') {
          const hasToAddNewItem = isElementEmpty(block()?.bgOptions()?.mobileBgimage());
          if (hasToAddNewItem) {
            extraItems.push(getAlertText(formatBlockName(block().type()), 'Mobile', viewModel.t('Missing background image')));
          }
        }
        if (block()?.bgOptions()?.bgImageChoice && block()?.bgOptions()?.bgImageChoice() === 'custom' ||
          block()?.bgOptions()?.bgImageVisible && block()?.bgOptions()?.bgImageVisible()
        ) {
          const hasToAddNewItem = isElementEmpty(block()?.bgOptions()?.bgimage());
          if (hasToAddNewItem) {
            extraItems.push(getAlertText(formatBlockName(block().type()), '', viewModel.t('Missing background image')));
          }
        }
        return null;
      }
      return newItem;
    })
    .filter(block => block && block !== null);

  const itemsForLinks = $(parsedHtml)
    .find('a[href="#toreplace"]')
    .toArray()
    .map(e => `${e.textContent?.trim() ? `${viewModel.t('Missing link label:')} ${e.textContent?.trim()}` : viewModel.t('Picture with no link')}`);

  return itemsForBackgroundImage.concat(itemsForLinks).concat(extraItems);
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

module.exports = {
  getErrorsForControlQuality,
  displayErrors
}

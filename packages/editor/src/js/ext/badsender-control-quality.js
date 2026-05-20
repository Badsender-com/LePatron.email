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
  checkAndDisplaySizeWarning(viewModel)
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

function checkAndDisplaySizeWarning(viewModel) {

  const sizeThreshold = 102 * 1024;   // 102KB in octets
  const htmlToExport = viewModel.exportHTML();
  const exportedHtmlSize = new Blob([htmlToExport]).size; // to calculate the size of the exported HTML in octets

  if (exportedHtmlSize > sizeThreshold) {
    displaySizeWarning(viewModel);
  } else {
    // Remove any existing size warning message
    $('.size-warning-message').remove();
  }
}

function displaySizeWarning(viewModel) {
  // Remove any existing size warning message
  $('.size-warning-message').remove();

  // Define the default English messages with keys for translation
  const warningTitleKey = 'Excessive Size';
  const warningDescriptionKey = 'The exported HTML exceeds 102KB, which may result in clipping email on Gmail.';

  // Construct the warning message elements with translation keys
  const $warningMessageTitle = $(`<h3>${viewModel.t(warningTitleKey)}</h3>`);
  const $warningMessageDescription = $(`<p>${viewModel.t(warningDescriptionKey)}</p>`);

  // Create the warning message container with styling
  const $warningMessageDiv = $('<div class="size-warning-message"></div>');

  // Insert the warning message before the specified body location
  $warningMessageDiv.insertBefore('replacedbody');
  // Append the title and description to the container
  $warningMessageDiv.append($warningMessageTitle, $warningMessageDescription);
}




/**
 * Returns the list of required tracking keys (as defined by the group config)
 * that have no value set in vm.content().tracking().trackingUrls.
 */
function checkRequiredTrackingParams(viewModel) {
  const cfg = viewModel && viewModel.metadata && viewModel.metadata.trackingConfig;
  if (!cfg || !cfg.enabled || !Array.isArray(cfg.params)) return [];
  const requiredKeys = cfg.params
    .filter((p) => p && p.required)
    .map((p) => p.key);
  if (requiredKeys.length === 0) return [];

  let trackingUrls = [];
  try {
    trackingUrls = viewModel.content().tracking().trackingUrls() || [];
  } catch (_e) {
    trackingUrls = [];
  }
  const filled = new Set(
    trackingUrls
      .filter((tu) => tu && tu.key && tu.value && String(tu.value).length > 0)
      .map((tu) => tu.key)
  );
  return requiredKeys.filter((k) => !filled.has(k));
}

/**
 * Display a blocking-style modal when required tracking params are missing.
 * Uses a jQuery-built overlay (Mosaico is a Knockout/jQuery editor, no Vue
 * mount point readily available here) styled to match the LePatron design
 * system: primary header, body with tint-error info block, footer with cta
 * button (cf. ui_kits/app/NewMailingDialog.jsx).
 */
function displayTrackingError(missingKeys, viewModel) {
  // Remove any previous instance
  $('.bs-tracking-modal-overlay').remove();

  const title = viewModel.t('trackingRequiredTitle');
  const description = viewModel.t('trackingRequiredDescription');
  const closeLabel = viewModel.t('trackingRequiredClose');

  // Escape any user-controlled values before injecting into the DOM
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  const keysHtml = missingKeys
    .map((k) => `<code class="bs-tracking-modal__key">${escapeHtml(k)}</code>`)
    .join(' ');

  // Inline Lucide "x" icon for the header close button (same SVG used elsewhere)
  const xIcon =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  // Inline Lucide "alert-circle" icon for the body tint block
  const alertIcon =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

  const $overlay = $(`
    <div class="bs-tracking-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bs-tracking-modal-title">
      <div class="bs-tracking-modal">
        <header class="bs-tracking-modal__header">
          <span id="bs-tracking-modal-title" class="bs-tracking-modal__title">${escapeHtml(title)}</span>
          <button type="button" class="bs-tracking-modal__icon-btn bs-tracking-modal__close-x" aria-label="${escapeHtml(closeLabel)}">${xIcon}</button>
        </header>
        <div class="bs-tracking-modal__body">
          <div class="bs-tracking-modal__alert">
            <span class="bs-tracking-modal__alert-icon">${alertIcon}</span>
            <span class="bs-tracking-modal__alert-text">${escapeHtml(description)}</span>
          </div>
          <div class="bs-tracking-modal__keys">${keysHtml}</div>
        </div>
        <footer class="bs-tracking-modal__footer">
          <button type="button" class="bs-tracking-modal__btn bs-tracking-modal__btn--cta">${escapeHtml(closeLabel)}</button>
        </footer>
      </div>
    </div>
  `);

  const close = () => {
    $overlay.remove();
    $(document).off('keydown.bsTrackingModal');
  };

  $overlay.on('click', (evt) => {
    if (evt.target === $overlay[0]) close();
  });
  $overlay.on('click', '.bs-tracking-modal__close-x, .bs-tracking-modal__btn--cta', close);
  $(document).on('keydown.bsTrackingModal', (evt) => {
    if (evt.key === 'Escape') close();
  });

  $('body').append($overlay);
  // Focus the cta button so Esc/Enter work right away
  $overlay.find('.bs-tracking-modal__btn--cta').focus();
}

module.exports = {
  getErrorsForControlQuality,
  displayErrors,
  checkRequiredTrackingParams,
  displayTrackingError,
}

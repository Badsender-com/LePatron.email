const $ = require('jquery');
const { messageText } = require('./quality/message-params');

// The modals of the export gate (ext/quality/quality-gate.js): the wait for
// the server's checks, with its "Cancel", and the findings that stop the
// download or the ESP send. They reuse the editor's modal framework
// (.bs-modal-overlay / .bs-modal-card / .modal-content / .modal-footer /
// .btn / .btn-flat, badsender-modal.less). Everything is escaped: a message
// may quote the email's own content (a link label).

const escapeText = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c])
  );

const SPINNER =
  '<div class="bs-modal-spinner quality-wait-modal__spinner" aria-hidden="true"><svg class="bs-modal-spinner-svg" viewBox="0 0 50 50"><circle class="bs-modal-spinner-circle" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle></svg></div>';

/**
 * Appends a modal of the editor's framework and wires its closing.
 * @param {Object} options
 * @param {string} options.name - its class, and the namespace of its keys
 * @param {string} options.content - HTML of .modal-content, escaped
 * @param {string} options.footer - HTML of .modal-footer, escaped
 * @param {Function} options.onEscape - what the Escape key does
 * @param {boolean} [options.dismissible] - a click outside closes it
 * @returns {Object} the overlay, and `close()`
 */
function mountModal({ name, content, footer, onEscape, dismissible = false }) {
  // A modal of the same name is replaced, its keys with it.
  $(`.bs-modal-overlay.${name}`).remove();
  $(document).off(`.${name}`);
  const $overlay = $(`
    <div class="bs-modal-overlay quality-modal ${name} small-modal" role="dialog" aria-modal="true" aria-labelledby="${name}-title">
      <div class="bs-modal-container">
        <div class="bs-modal-card">
          <div class="bs-modal-content-wrapper">
            <div class="modal-content">${content}</div>
            <div class="modal-footer">${footer}</div>
          </div>
        </div>
      </div>
    </div>
  `);
  const keys = `keydown.${name}`;
  const close = () => {
    $overlay.remove();
    $(document).off(keys);
  };
  if (dismissible) {
    $overlay.on('click', (evt) => {
      if (evt.target === $overlay[0]) close();
    });
  }
  $(document).on(keys, (evt) => {
    if (evt.key === 'Escape') onEscape();
  });
  $('body').append($overlay);
  return { $overlay, close };
}

/**
 * Shows that the export waits for the server's checks of the links and
 * images. "Cancel" (or Escape) abandons the export.
 * @param {Object} viewModel - for its translations
 * @param {Object} options
 * @param {number} options.seconds - how long the export waits at most
 * @param {Function} options.onCancel
 * @returns {{ close: Function }}
 */
function displayWaitingForChecks(viewModel, { seconds, onCancel }) {
  const t = (key, params) => viewModel.t(key, params);
  const cancel = () => {
    modal.close();
    onCancel();
  };
  const modal = mountModal({
    name: 'quality-wait-modal',
    content: `
      ${SPINNER}
      <h5 id="quality-wait-modal-title">${escapeText(
        t('Checking links and images…')
      )}</h5>
      <p class="quality-wait-modal__text">${escapeText(
        t('The export goes on once they are checked, within about __seconds__ seconds.', { seconds })
      )}</p>`,
    footer: `<button type="button" class="btn-flat waves-effect quality-wait-modal__cancel">${escapeText(
      t('quality-action-cancel')
    )}</button>`,
    onEscape: cancel,
  });
  modal.$overlay.attr('aria-busy', 'true');
  modal.$overlay.on('click', '.quality-wait-modal__cancel', cancel);
  modal.$overlay.find('.quality-wait-modal__cancel').focus();
  return { close: modal.close };
}

/**
 * Lists the findings that stop the download or the ESP send.
 * @param {Array} findings - findings with `blocking`, as the engine returns them
 * @param {Object} viewModel - for its translations
 * @param {Object} [options]
 * @param {Function} [options.onReveal] - "See in the quality control": shows
 *   the first of them in the drawer
 */
function displayBlockingFindings(findings, viewModel, { onReveal } = {}) {
  const t = (key, params) => viewModel.t(key, params);
  const items = findings
    .map((finding) => {
      const where = finding.blockLabel ? ` · ${finding.blockLabel}` : '';
      const message = messageText(t, finding.messageKey, finding.params);
      return `<li class="blocking-modal__item"><strong>${escapeText(
        t(finding.titleKey)
      )}</strong>${escapeText(where)}<br>${escapeText(message)}</li>`;
    })
    .join('');
  const reveal = onReveal
    ? `<button type="button" class="btn waves-effect waves-light blocking-modal__reveal">${escapeText(
        t('See in the quality control')
      )}</button>`
    : '';
  const close = () => modal.close();
  const modal = mountModal({
    name: 'blocking-modal',
    content: `
      <h5 id="blocking-modal-title">${escapeText(
        t('This email cannot leave yet')
      )}</h5>
      <div class="quality-modal__alert"><span>${escapeText(
        t('Your company made these checks blocking: fix them before downloading or sending the email.')
      )}</span></div>
      <ul class="blocking-modal__list">${items}</ul>`,
    footer: `<button type="button" class="btn-flat waves-effect blocking-modal__close">${escapeText(
      t('quality-action-close')
    )}</button>${reveal}`,
    onEscape: close,
    dismissible: true,
  });
  modal.$overlay.on('click', '.blocking-modal__close', close);
  modal.$overlay.on('click', '.blocking-modal__reveal', () => {
    close();
    onReveal();
  });
  modal.$overlay.find('.blocking-modal__close').focus();
}

module.exports = { displayBlockingFindings, displayWaitingForChecks };

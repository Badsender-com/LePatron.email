const $ = require('jquery');
const {
  checkRequiredTrackingParams,
} = require('./quality/rules/tracking-params');

// The one quality check that blocks: download and ESP send refuse to go on
// while a required tracking parameter is missing. Every other check is shown
// in the quality drawer (ext/quality, vue/components/quality-drawer).

/**
 * Display a blocking-style modal when required tracking params are missing.
 * Reuses the editor's existing modal framework (.bs-modal-overlay /
 * .bs-modal-card / .modal-content / .modal-footer / .btn / .btn-flat) so the
 * look-and-feel matches save-block-modal, delete-block-modal, etc.
 */
function displayTrackingError(missingKeys, viewModel) {
  $('.bs-modal-overlay.tracking-modal').remove();

  const title = viewModel.t('trackingRequiredTitle');
  const description = viewModel.t('trackingRequiredDescription');
  const closeLabel = viewModel.t('trackingRequiredClose');

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  const keysHtml = missingKeys
    .map((k) => `<code class="tracking-modal__key">${escapeHtml(k)}</code>`)
    .join(' ');

  // Lucide alert-circle, inlined to avoid asset dependencies
  const alertIcon =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

  const $overlay = $(`
    <div class="bs-modal-overlay tracking-modal small-modal" role="dialog" aria-modal="true" aria-labelledby="tracking-modal-title">
      <div class="bs-modal-container">
        <div class="bs-modal-card">
          <div class="bs-modal-content-wrapper">
            <div class="modal-content">
              <h5 id="tracking-modal-title">${escapeHtml(title)}</h5>
              <div class="tracking-modal__alert">
                <span class="tracking-modal__alert-icon">${alertIcon}</span>
                <span>${escapeHtml(description)}</span>
              </div>
              <div class="tracking-modal__keys">${keysHtml}</div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn waves-effect waves-light tracking-modal__close">${escapeHtml(closeLabel)}</button>
            </div>
          </div>
        </div>
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
  $overlay.on('click', '.tracking-modal__close', close);
  $(document).on('keydown.bsTrackingModal', (evt) => {
    if (evt.key === 'Escape') close();
  });

  $('body').append($overlay);
  $overlay.find('.tracking-modal__close').focus();
}

module.exports = {
  checkRequiredTrackingParams,
  displayTrackingError,
};

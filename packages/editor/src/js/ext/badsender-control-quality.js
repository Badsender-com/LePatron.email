const $ = require('jquery');
const {
  checkRequiredTrackingParams,
} = require('./quality/rules/tracking-params');

// What blocks an export. The quality settings of the mailing make checks
// blocking (ADR 0004): the download and the ESP send stop while one of their
// findings remains, and this modal lists them; the drawer shows them too.
// displayTrackingError is the older modal of the required tracking parameters,
// kept for the ESP send until it goes through the same gate (#1201).

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

const escapeText = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

/**
 * Lists the findings that stop the download or the ESP send. Everything is
 * escaped: a message may quote the email's own content (a link label).
 * @param {Array} findings - findings with `blocking`, as the engine returns them
 * @param {Object} viewModel - for its translations
 */
function displayBlockingFindings(findings, viewModel) {
  $('.bs-modal-overlay.blocking-modal').remove();
  const t = (key, params) => viewModel.t(key, params);
  const items = findings
    .map((finding) => {
      const where = finding.blockLabel ? ` · ${finding.blockLabel}` : '';
      return `<li class="blocking-modal__item"><strong>${escapeText(
        t(finding.titleKey)
      )}</strong>${escapeText(where)}<br>${escapeText(
        t(finding.messageKey, finding.params)
      )}</li>`;
    })
    .join('');

  const $overlay = $(`
    <div class="bs-modal-overlay tracking-modal blocking-modal small-modal" role="dialog" aria-modal="true" aria-labelledby="blocking-modal-title">
      <div class="bs-modal-container">
        <div class="bs-modal-card">
          <div class="bs-modal-content-wrapper">
            <div class="modal-content">
              <h5 id="blocking-modal-title">${escapeText(
                t('This email cannot leave yet')
              )}</h5>
              <div class="tracking-modal__alert">
                <span>${escapeText(
                  t('Your quality settings make these checks blocking: fix them before downloading or sending the email.')
                )}</span>
              </div>
              <ul class="blocking-modal__list">${items}</ul>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn waves-effect waves-light blocking-modal__close">${escapeText(
                t('Close')
              )}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);

  const close = () => {
    $overlay.remove();
    $(document).off('keydown.bsBlockingModal');
  };
  $overlay.on('click', (evt) => {
    if (evt.target === $overlay[0]) close();
  });
  $overlay.on('click', '.blocking-modal__close', close);
  $(document).on('keydown.bsBlockingModal', (evt) => {
    if (evt.key === 'Escape') close();
  });

  $('body').append($overlay);
  $overlay.find('.blocking-modal__close').focus();
}

module.exports = {
  checkRequiredTrackingParams,
  displayTrackingError,
  displayBlockingFindings,
};

'use strict';

// What the gallery's calls share: listing, renaming, deleting, and reading a
// stored image back to edit it.

// Without a ceiling, a stalled connection leaves the panel on "loading…" or
// a label waiting for an answer that never comes, with nothing said. One
// budget, so the four calls cannot drift apart.
const GALLERY_REQUEST_TIMEOUT_MS = 15000;

// jQuery reports a timeout as the status text, with HTTP status 0.
function timedOut(jqXHR, textStatus) {
  return (
    textStatus === 'timeout' || Boolean(jqXHR && jqXHR.statusText === 'timeout')
  );
}

// A request that ran out of time may still have reached the server and been
// applied. Saying the change was undone would be a guess, so the user is told
// the truth and the gallery is reloaded from the server, which shows where it
// stands (or, if the server is still unreachable, brings back the "Load
// gallery" button to retry).
function reloadAfterTimeout(viewModel, type) {
  viewModel.notifier.error(viewModel.t('gallery-request-unconfirmed'));
  const load =
    type === 'template'
      ? viewModel.loadTemplateGallery
      : viewModel.loadMailingGallery;
  if (typeof load === 'function') load();
}

module.exports = {
  GALLERY_REQUEST_TIMEOUT_MS,
  timedOut,
  reloadAfterTimeout,
};

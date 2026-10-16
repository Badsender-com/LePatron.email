'use strict';

const $ = require('jquery');

const { sanitizeLabel } = require('../../../../shared/gallery/label.js');
const { renameGalleryImageLabel } = require('../vue/utils/apis');

// A gallery file is stored as `<mongoId>-<hash>.<ext>`: the prefix is the id of
// the mailing or template the gallery belongs to, which is what the route needs.
// `apis.renameGalleryImageLabel` interpolates this capture into a URL without
// encoding it — safe only because the class cannot produce `/`, `?` or `#`.
const MONGO_ID = /^([a-f\d]{24})-/;

// A hung request would otherwise leave the optimistic label in place forever,
// with nothing to tell the user it never landed.
const TIMEOUT_MS = 15000;

function renameGalleryImage(viewModel) {
  // One entry per file name while a rename is in flight. Without it, two
  // renames of the same image race: the first one's failure restores a label
  // the user has already replaced, and the error says the previous value was
  // put back when in fact a newer one was discarded.
  const inFlight = new Map();
  let nextSequence = 1;

  function fail(messageKey) {
    viewModel.notifier.error(viewModel.t(messageKey));
    return false;
  }

  /**
   * Rename what the user reads under a thumbnail. The technical file name never
   * moves — only this label, which is also what the search matches on.
   *
   * Optimistic: the new label is what the user just typed, so showing it before
   * the server confirms costs nothing, and a failure puts the old one back.
   *
   * @param {object} file the gallery file, as the grid holds it
   * @param {'mailing'|'template'} type which of the two galleries it belongs to
   * @param {string} rawLabel what the user typed
   * @returns {Promise<boolean>} whether the label is now what the user asked for
   */
  viewModel.renameImage = function renameImage(file, type, rawLabel) {
    const gallery = viewModel[type + 'Gallery'];
    const label = sanitizeLabel(rawLabel);
    const name = file.name || '';
    const match = MONGO_ID.exec(name);

    // nothing to do — not a failure, and nothing to say
    if (!label || label === (file.label || name)) return Promise.resolve(false);

    // these two are failures, and used to be silent: the user watched their new
    // name disappear with no explanation and no way to get the text back
    if (!match) return Promise.resolve(fail('gallery-rename-image-unsupported'));

    const index = gallery().findIndex((f) => f.name === name);
    if (index === -1) return Promise.resolve(fail('gallery-rename-image-gone'));

    const previous = gallery()[index];
    const sequence = nextSequence++;
    const earlier = inFlight.get(name);
    inFlight.set(name, {
      sequence,
      // revert to what was there before the FIRST rename of this burst, not to
      // the optimistic value an earlier one of our own put in
      baseline: earlier ? earlier.baseline : previous,
    });

    // Replace the entry instead of mutating it: Knockout notifies on array
    // operations, not on a property of an element, and the Vue grid mirrors
    // this array. Same `name`, so the virtual scroller keeps the same view.
    replaceByName(gallery, name, Object.assign({}, previous, { label: label }));

    // An older request settling after a newer one must not touch the grid: the
    // newer one owns the state, whichever way it went. Returns the entry it
    // just retired — read the baseline from THAT, not from the map, which this
    // call has already emptied.
    const claimSettlement = () => {
      const current = inFlight.get(name);
      if (!current || current.sequence !== sequence) return null;
      inFlight.delete(name);
      return current;
    };

    return $.ajax({
      url: renameGalleryImageLabel(match[1], name),
      method: 'PATCH',
      type: 'PATCH',
      contentType: 'application/json',
      timeout: TIMEOUT_MS,
      data: JSON.stringify({ label: label }),
    })
      .then(function onAccepted(stored) {
        if (!claimSettlement()) return false;
        // The server answers with the file as it stored it. Take that rather
        // than our own guess: it carries any normalisation we did not do, and
        // a concurrent delete may have replaced the whole array in between.
        if (stored && stored.name) replaceByName(gallery, name, stored);
        return true;
      })
      .catch(function onRefused(jqXHR) {
        const settled = claimSettlement();
        if (!settled) return false;
        replaceByName(gallery, name, settled.baseline);
        // eslint-disable-next-line no-console
        console.error('gallery rename failed', jqXHR && jqXHR.status, jqXHR);
        return fail(messageForStatus(jqXHR));
      });
  };
}

// Put `entry` where the file called `name` currently sits. By name rather than
// by a remembered index: an upload unshifts, a delete replaces the whole array,
// and either can land while a request is in flight.
function replaceByName(gallery, name, entry) {
  const index = gallery().findIndex((f) => f.name === name);
  if (index === -1) return false;
  gallery.splice(index, 1, entry);
  return true;
}

// The server distinguishes its refusals; collapsing them into one message left
// the user unable to tell "too long" from "not yours" from "the server is down".
function messageForStatus(jqXHR) {
  const status = jqXHR && jqXHR.status;
  if (status === 400 || status === 422) return 'gallery-rename-image-invalid';
  if (status === 401 || status === 403) return 'gallery-rename-image-forbidden';
  if (status === 404) return 'gallery-rename-image-gone';
  return 'gallery-rename-image-fail';
}

module.exports = renameGalleryImage;

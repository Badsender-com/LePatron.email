'use strict';

// Tells the quality review that the email changed, so that results computed
// on an earlier version are marked as such instead of staying "done".
//
// The signal is the one the undo stack already uses (undomanager.js): ko-reactor
// watching `viewModel.content` at any depth. Head CSS lives outside the content
// model (undomain.js says the same), so it is watched on its own. The subject
// is not covered: the email metadata store keeps plain snapshots, not
// observables (utils/email-metadata-store.js).

const WATCH_OPTIONS = { depth: -1, mutable: true };

// ko-reactor registers `ko.watch` on the knockout instance it is given, and
// the bundle aliases it under `knockoutjs-reactor` (package.json). It is loaded
// here only if nothing registered it yet, and never required at module load:
// a build or a test without it must still get a review, only without the
// "stale" signal.
function ensureWatch(ko) {
  if (typeof ko.watch === 'function') return ko.watch;
  try {
    require('knockoutjs-reactor');
  } catch (_err) {
    return null;
  }
  return typeof ko.watch === 'function' ? ko.watch : null;
}

/**
 * Calls `onChange` on every change of the email content, and of the head CSS.
 * @param {Object} viewModel
 * @param {Object} ko - knockout
 * @param {Function} onChange
 * @returns {Function} stops watching
 */
function watchContent(viewModel, ko, onChange) {
  const subscriptions = [];
  const watch = ensureWatch(ko);
  if (watch && ko.isObservable(viewModel.content)) {
    subscriptions.push(watch(viewModel.content, WATCH_OPTIONS, onChange));
  }
  if (ko.isObservable(viewModel.headCss)) {
    subscriptions.push(viewModel.headCss.subscribe(onChange));
  }
  return () =>
    subscriptions.forEach((subscription) => {
      if (subscription && typeof subscription.dispose === 'function') {
        subscription.dispose();
      }
    });
}

module.exports = { watchContent };

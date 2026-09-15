'use strict';

/**
 * The bridge between the metadata section (Vue) and the editor's Save command
 * (Knockout).
 *
 * The section has no save button of its own: metadata are written by the editor's
 * Save, with everything else. That means two frameworks that know nothing about
 * each other need to agree on one payload, and on whether it is worth sending.
 * Rather than have the save command reach into a Vue instance, or the component
 * reach into a Knockout observable, both talk to this store.
 *
 * It holds two snapshots: what the section opened with, and what it holds now.
 * Everything else is derived, which is why this file is testable and the component
 * is not. Covered by tests/editor/email-metadata-store.test.js.
 */

const {
  buildMetadataPayload,
  hasMetadataChanges,
} = require('./email-metadata');

// null when the company is opted out and the section was never mounted: the save
// command must then behave exactly as it did before this feature existed.
let initial = null;
let current = null;

/** Whether a metadata section is mounted at all. */
function isActive() {
  return initial !== null;
}

/**
 * Arm the store with the state the section opens with. Also called after the
 * editor swaps templates, which remounts the section.
 */
function reset(formState) {
  initial = { ...formState };
  current = { ...formState };
}

/** Called by the component on every edit. */
function setCurrent(formState) {
  if (!isActive()) return;
  current = { ...formState };
}

/**
 * Whether the metadata carry unsaved edits, i.e. whether the PATCH is worth
 * sending at all.
 *
 * False when no section is mounted, so an opted-out company never sends a request
 * on account of a feature it does not have.
 */
function isDirty() {
  if (!isActive()) return false;
  return hasMetadataChanges(current, initial);
}

/** The PATCH body for the current state. */
function payload() {
  return buildMetadataPayload(current || {});
}

/** The form state as it stands, to be handed back to markSaved once written. */
function snapshot() {
  return { ...(current || {}) };
}

/**
 * Called once the PATCH succeeded, with the snapshot that was actually SENT.
 *
 * The snapshot matters. Resetting to `current` instead would mark as saved
 * whatever the user typed WHILE the request was in flight: the button goes quiet,
 * the correction was never sent, and it is gone on the next reload with no signal
 * at all. Measured against the wrong state, a save silently eats an edit.
 *
 * Deliberately NOT called on failure: the state stays dirty so the next Save sends
 * the payload again instead of treating it as written.
 *
 * @param {Object} [sent] the state handed to the server; defaults to the current
 *   one, which is only correct when nothing can have changed since.
 */
function markSaved(sent) {
  if (!isActive()) return;
  initial = { ...(sent || current) };
}

/** Torn down with the section when the editor swaps templates. */
function dispose() {
  initial = null;
  current = null;
}

module.exports = {
  isActive,
  reset,
  setCurrent,
  isDirty,
  payload,
  snapshot,
  markSaved,
  dispose,
};

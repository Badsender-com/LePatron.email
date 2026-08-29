'use strict';

/**
 * The bridge between the metadata section (Vue) and the editor's Save command
 * (Knockout).
 *
 * The section no longer has a save button of its own: metadata are written by the
 * editor's Save, with everything else. That means two frameworks that know nothing
 * about each other need to agree on one question — "is there anything unsaved?" —
 * and on one payload. Rather than have the save command reach into a Vue instance,
 * or the component reach into a Knockout observable, both talk to this store.
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
const listeners = [];

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
  notify();
}

/** Called by the component on every edit. */
function setCurrent(formState) {
  if (!isActive()) return;
  current = { ...formState };
  notify();
}

/**
 * Whether the metadata carry unsaved edits.
 *
 * False when no section is mounted, so an opted-out company never marks the Save
 * button as dirty on account of a feature it does not have.
 */
function isDirty() {
  if (!isActive()) return false;
  return hasMetadataChanges(current, initial);
}

/** The PATCH body for the current state. */
function payload() {
  return buildMetadataPayload(current || {});
}

/**
 * Called once the PATCH succeeded. Deliberately NOT called on failure: the state
 * stays dirty so the Save button keeps signalling there is something to retry.
 */
function markSaved() {
  if (!isActive()) return;
  initial = { ...current };
  notify();
}

/** Torn down with the section when the editor swaps templates. */
function dispose() {
  initial = null;
  current = null;
  notify();
}

/**
 * Subscribe to dirtiness changes. Returns an unsubscribe function.
 *
 * The listener is called on every edit, not only when the boolean flips: the save
 * command's observable does its own equality check, and a store that tried to be
 * clever here would have to duplicate the comparison it already does in isDirty.
 */
function onChange(listener) {
  listeners.push(listener);
  return function unsubscribe() {
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
  };
}

function notify() {
  const dirty = isDirty();
  listeners.slice().forEach((listener) => listener(dirty));
}

module.exports = {
  isActive,
  reset,
  setCurrent,
  isDirty,
  payload,
  markSaved,
  dispose,
  onChange,
};

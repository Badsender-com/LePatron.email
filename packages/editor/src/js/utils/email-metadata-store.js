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
 *
 * A FACTORY, not a module singleton, and the difference is not stylistic. Holding
 * `initial`/`current` at module scope made them a global: the store's lifetime was
 * then a convention — `reset()` and `dispose()` called in pairs on every template
 * swap — and a teardown that did not run left the store answering against the
 * previous template's form, silently. It also made every test responsible for
 * cleaning up after the last one.
 *
 * Hung off the viewModel by emailMetadataPlugin, which is where the editor's three
 * other plugins (espPlugin, trackingParamsPlugin, badsender-comments) already keep
 * their state. The store's lifetime is the viewModel's, and each test builds its own.
 */

const { buildMetadataPayload, hasMetadataChanges } = require('./email-metadata');

function createEmailMetadataStore() {
  // null until the section mounts. An opted-out company never arms the store, and
  // the save command must then behave exactly as it did before this feature existed.
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
   * False when no section is mounted, so an opted-out company never sends a
   * request on account of a feature it does not have.
   */
  function isDirty() {
    if (!isActive()) return false;
    return hasMetadataChanges(current, initial);
  }

  /**
   * The PATCH body: only the fields that actually changed.
   *
   * The comparison base is what the section opened with — or what the last
   * successful PATCH wrote, since `markSaved` moves it. Sending the untouched
   * fields too would let this editor revert a colleague's concurrent edit, and let
   * a stale typology fail the subject the user just typed.
   */
  function payload() {
    return buildMetadataPayload(current || {}, initial || {});
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
   * Deliberately NOT called on failure: the state stays dirty so the next Save
   * sends the payload again instead of treating it as written.
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

  return {
    isActive,
    reset,
    setCurrent,
    isDirty,
    payload,
    snapshot,
    markSaved,
    dispose,
  };
}

/**
 * The `beforeunload` listener of the email settings.
 *
 * These fields are the only plain form inputs in the editor, and a form input is
 * where a user expects their typing to survive. Everything else in the editor is
 * written through a command; the subject someone types and then closes the tab
 * on is gone with nothing said.
 *
 * A prompt on the way out, not a permanent indicator: the unsaved-state dot was
 * removed on purpose because it covered the metadata and nothing else, and a
 * signal that stays dark for a modified block tells the user their work is safe.
 * This fires only when the metadata are actually dirty, and says nothing the
 * rest of the time.
 *
 * @param {Object} store a store from createEmailMetadataStore
 * @returns {Function} the listener
 */
function unloadGuardFor(store) {
  return function unloadGuard(event) {
    if (!store.isDirty()) return undefined;
    // Browsers ignore the string and show their own wording; both forms are
    // still required for the prompt to appear at all.
    event.preventDefault();
    event.returnValue = '';
    return '';
  };
}

module.exports = { createEmailMetadataStore, unloadGuardFor };

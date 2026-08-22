'use strict';

/**
 * The panel's save orchestration, as a pure function.
 *
 * It is here rather than inside the Vue component because it is the riskiest code
 * of the panel and the editor has no component test harness: two writes, in order,
 * against two different mechanisms, and a state to update only for the ones that
 * actually succeeded.
 *
 *   - subject / planned send date / typology → `PATCH /mailings/:id/metadata`
 *   - preheader → already written to the template's live observable; only the
 *     editor's global save persists it
 *
 * The global save is awaited. Announcing success before it lands, or marking the
 * preheader clean, would leave the user with a confirmation, a disabled Save
 * button, and an unsaved preheader — with no way to retry from the panel.
 */

const OUTCOME = Object.freeze({
  NOTHING: 'nothing',
  METADATA: 'metadata',
  BOTH: 'both',
});

/**
 * @param {Object} params
 * @param {boolean} params.metadataChanged whether the PATCH has anything to send
 * @param {boolean} params.preheaderChanged whether the global save is needed
 * @param {Function} params.patch      () => Promise, the PATCH
 * @param {Function} params.globalSave () => Promise|undefined, the editor's save
 * @param {Function} [params.canGlobalSave] () => boolean, false while one is in
 *   flight — two concurrent saves can write an older `data` last
 * @returns {Promise<{outcome: string, savedMetadata: boolean, savedPreheader: boolean}>}
 * @throws whatever `patch` or `globalSave` rejected with, after reporting which
 *   half had succeeded through `error.partial`
 */
async function runSave({
  metadataChanged,
  preheaderChanged,
  patch,
  globalSave,
  canGlobalSave = () => true,
}) {
  if (!metadataChanged && !preheaderChanged) {
    return { outcome: OUTCOME.NOTHING, savedMetadata: false, savedPreheader: false };
  }

  let savedMetadata = false;

  // Only when it has something to say: a PATCH rewriting three unchanged fields
  // is a request for nothing, and it makes the server revalidate the typology.
  if (metadataChanged) {
    await patch();
    savedMetadata = true;
  }

  if (!preheaderChanged) {
    return { outcome: OUTCOME.METADATA, savedMetadata, savedPreheader: false };
  }

  if (!canGlobalSave()) {
    const error = new Error('SAVE_IN_FLIGHT');
    error.code = 'SAVE_IN_FLIGHT';
    error.partial = { savedMetadata, savedPreheader: false };
    throw error;
  }

  try {
    // `undefined` when the editor's save command does not hand back a promise;
    // awaiting it is then a no-op rather than a crash.
    await globalSave();
  } catch (cause) {
    // The PATCH already landed. The caller must know, so it can keep the
    // preheader dirty without pretending nothing was saved.
    cause.partial = { savedMetadata, savedPreheader: false };
    throw cause;
  }

  return { outcome: OUTCOME.BOTH, savedMetadata, savedPreheader: true };
}

module.exports = { runSave, OUTCOME };

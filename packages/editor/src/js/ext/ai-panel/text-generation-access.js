'use strict';

const { userCan } = require('../user-can.js');
const { availableActions } = require('./action-registry');
const { CAPABILITIES } = require('../../../../../shared/access/roles.js');

/**
 * Whether this user may run the text generation actions on this email: the
 * feature on for the company (`hasTextGenerationFeature`), and the capability
 * the text generation routes ask for (`GUARD_CAN(MAILING_EDIT_CONTENT)`), where
 * the email lives (`userCan`). A reviewer sees no AI tool rather than a refusal.
 *
 * The one condition of the « Outils IA » button, the panel and the action
 * registry's context (ext/ai-panel/editor-access.js), which the field icons
 * follow. Denied until the current user is known, like `userCan`, and reads its
 * observable, so a binding re-evaluates once the user arrives.
 *
 * @param {Object} vm the editor view-model
 * @returns {boolean}
 */
function canUseTextGeneration(vm) {
  return (
    Boolean(vm.metadata && vm.metadata.hasTextGenerationFeature) &&
    userCan(vm, CAPABILITIES.MAILING_EDIT_CONTENT)
  );
}

/**
 * Whether the company's text generation offers an AI action on a kind of
 * target: the registry asked with the company's data alone, the feature and
 * the skills that run for it. For what is built once, before the current user
 * is known, as the text editor's toolbar: the panel checks the user's right
 * when it is opened from there.
 *
 * @param {Object} [metadata] the editor metadata
 * @param {string} kind a target kind (ext/ai-panel/targets.js)
 * @returns {boolean}
 */
function companyOffersOn(metadata, kind) {
  if (!metadata) return false;
  const context = {
    textGeneration: Boolean(metadata.hasTextGenerationFeature),
    skills: metadata.textGenerationSkills || [],
  };
  return availableActions({ kind }, context).actions.length > 0;
}

module.exports = { canUseTextGeneration, companyOffersOn };

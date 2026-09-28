'use strict';

const { BadRequest } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const {
  TranslationFormalityValues,
} = require('../constant/translation-formality.js');

// Shape of an accepted model identifier. Deliberately a format check and not
// a whitelist: free typing is a product requirement (models released after a
// deploy, Azure deployment names, self-hosted OpenAI-compatible endpoints), so
// the closed list the providers used to expose cannot be the gate. `/`, `:`
// and `@` are allowed on purpose — real identifiers use them
// (`accounts/<org>/models/<name>`, `mistral:7b`). Whitespace and quotes are
// not: those are what would break a header or a JSON payload downstream.
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;

/**
 * Normalize and validate `config.model` in place.
 *
 * The empty string is the case that matters. The model field is fed by a
 * combobox, which yields '' when the user clears it — and '' is neither
 * undefined nor null, so it survives the `pickWithSource` chain in
 * config-resolver and would be handed to the provider as the group's chosen
 * model. Mapping it back to null is what makes "clear the field" mean "fall
 * back to the provider default".
 */
function normalizeModelId(featureConfig) {
  if (!featureConfig || featureConfig.model === undefined) return;
  if (featureConfig.model === null) return;

  const model = String(featureConfig.model).trim();
  if (model === '') {
    featureConfig.model = null;
    return;
  }
  if (!MODEL_ID_PATTERN.test(model)) {
    throw new BadRequest(ERROR_CODES.INVALID_MODEL_ID);
  }
  featureConfig.model = model;
}

/**
 * Reject a formality the schema would refuse.
 *
 * The enum on the schema never fires here: updateFeatureConfig writes through
 * findByIdAndUpdate + $set, which does not run validators. An arbitrary value
 * would be persisted and then sent to DeepL, which would reject every
 * translation of the group — on the one connector in production.
 */
function validateFormality(featureConfig) {
  if (!featureConfig || featureConfig.formality === undefined) return;
  if (!TranslationFormalityValues.includes(featureConfig.formality)) {
    throw new BadRequest(ERROR_CODES.INVALID_FORMALITY);
  }
}

function validateAvailableLanguages(featureConfig) {
  const langs = featureConfig && featureConfig.availableLanguages;
  if (langs && langs.length > 0 && langs.length < 2) {
    throw new BadRequest(ERROR_CODES.MIN_LANGUAGES_REQUIRED);
  }
}

/**
 * Normalize and validate the `config` of a feature update, in place.
 *
 * Every check lives here rather than on the schema because
 * updateFeatureConfig writes through findByIdAndUpdate + $set, which runs no
 * schema validator.
 *
 * @param {Object} [featureConfig] the partial config sent by the client
 * @throws {BadRequest} on the first invalid field
 */
function validateFeatureConfig(featureConfig) {
  normalizeModelId(featureConfig);
  validateFormality(featureConfig);
  validateAvailableLanguages(featureConfig);
}

module.exports = {
  validateFeatureConfig,
  // Mirrored by the model picker (ui/helpers/ai-model-picker.js); a test keeps
  // the two identical.
  MODEL_ID_PATTERN,
};

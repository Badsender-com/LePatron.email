'use strict';

const { TEXT_FEATURE_TYPES } = require('../../constant/ai-feature-type.js');
const { configError } = require('./invocation-config-error.js');

/**
 * The arguments checked before anything is read or billed.
 *
 * @returns {Array<{expertiseId, versionMajor, versionMinor}>} the expertise
 *   versions to log, without what else the caller's entries carry
 */
function readArguments({ featureType, expertiseConsumed }) {
  // Only an engine that writes text runs a skill: not translation's, which
  // can be DeepL.
  if (!TEXT_FEATURE_TYPES.includes(featureType)) {
    throw configError(
      500,
      `"${featureType}" is not a feature that runs skills`
    );
  }
  // An entry the log refuses would lose the invocation's row after the
  // provider call.
  if (!isConsumedList(expertiseConsumed)) {
    throw configError(
      500,
      'expertiseConsumed must be a list of entries with an expertiseId'
    );
  }
  return expertiseConsumed.map((e) => ({
    expertiseId: e.expertiseId,
    versionMajor: e.versionMajor,
    versionMinor: e.versionMinor,
  }));
}

function isConsumedList(entries) {
  return (
    Array.isArray(entries) &&
    entries.every(
      (entry) =>
        typeof entry?.expertiseId === 'string' && entry.expertiseId !== ''
    )
  );
}

module.exports = { readArguments };

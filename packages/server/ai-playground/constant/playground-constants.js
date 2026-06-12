'use strict';

const ScenarioIdRegex = /^[a-z0-9._-]+$/;
const MaxScenarioIdLength = 100;

const VersionRefModes = Object.freeze({ ACTIVE: 'active', PINNED: 'pinned' });
const VersionRefModeValues = Object.values(VersionRefModes);

// NB: the expertise selection mode is implicit on the scenario (non-empty
// expertiseRefs wins over expertiseFilter, cf. expertise-resolver.service.js)
// — there is deliberately no persisted enum for it.

const RunStatuses = Object.freeze({
  SUCCESS: 'SUCCESS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
  CONFIG_ERROR: 'CONFIG_ERROR',
});
const RunStatusValues = Object.values(RunStatuses);

const FeedbackRatings = Object.freeze({
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
});
const FeedbackRatingValues = Object.values(FeedbackRatings);

const DefaultPlaygroundRunRetentionDays = 365;
const PlaygroundFeatureType = 'playground';

module.exports = {
  ScenarioIdRegex,
  MaxScenarioIdLength,
  VersionRefModes,
  VersionRefModeValues,
  RunStatusValues,
  FeedbackRatingValues,
  DefaultPlaygroundRunRetentionDays,
  PlaygroundFeatureType,
};

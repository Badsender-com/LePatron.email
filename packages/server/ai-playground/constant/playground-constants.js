'use strict';

const ScenarioIdRegex = /^[a-z0-9._-]+$/;
const MaxScenarioIdLength = 100;

const VersionRefModes = Object.freeze({ ACTIVE: 'active', PINNED: 'pinned' });
const VersionRefModeValues = Object.values(VersionRefModes);

const ExpertiseSelectionModes = Object.freeze({
  NONE: 'none',
  EXPLICIT: 'explicit',
  FILTER: 'filter',
});
const ExpertiseSelectionModeValues = Object.values(ExpertiseSelectionModes);

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
  ExpertiseSelectionModes,
  ExpertiseSelectionModeValues,
  RunStatuses,
  RunStatusValues,
  FeedbackRatings,
  FeedbackRatingValues,
  DefaultPlaygroundRunRetentionDays,
  PlaygroundFeatureType,
};

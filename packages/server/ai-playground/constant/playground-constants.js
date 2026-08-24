'use strict';

const {
  InvocationStatuses,
} = require('../../ai-skill/constant/skill-constants.js');

const ScenarioIdRegex = /^[a-z0-9._-]+$/;
const MaxScenarioIdLength = 100;

const VersionRefModes = Object.freeze({ ACTIVE: 'active', PINNED: 'pinned' });
const VersionRefModeValues = Object.values(VersionRefModes);

// NB: the expertise selection mode is implicit on the scenario (non-empty
// expertiseRefs wins over expertiseFilter, cf. expertise-resolver.service.js)
// — there is deliberately no persisted enum for it.

// A run's status IS the status of the invocation that produced it. Derived, not
// copied: the enum used to be duplicated by hand, so the day ai-skill added a
// status the runner would hand it to `AIPlaygroundRuns.create()`, hit a
// mongoose ValidationError, and lose the run — after the LLM call was paid for.
const RunStatuses = InvocationStatuses;
const RunStatusValues = Object.values(RunStatuses);

const FeedbackRatings = Object.freeze({
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
});
const FeedbackRatingValues = Object.values(FeedbackRatings);

// Daily run quota per user, enforced by test-budget.service.js. Lived in
// skill-constants as MaxDailyTestInvocations while the super-admin Test runner
// existed; the playground is its only consumer now.
const MaxDailyPlaygroundRuns = 50;
const DefaultPlaygroundRunRetentionDays = 365;
// Analytics source tag carried by every AISkillInvocation the runner
// produces. Reserved as non-productive server-side (NonProductiveSources in
// invocation-log.service.js), so playground traffic stays out of the default
// Invocations view.
const PlaygroundInvocationSource = 'playground';

module.exports = {
  ScenarioIdRegex,
  RunStatuses,
  MaxScenarioIdLength,
  VersionRefModes,
  VersionRefModeValues,
  RunStatusValues,
  FeedbackRatingValues,
  MaxDailyPlaygroundRuns,
  DefaultPlaygroundRunRetentionDays,
  PlaygroundInvocationSource,
};

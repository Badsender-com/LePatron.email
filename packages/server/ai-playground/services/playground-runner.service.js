'use strict';

const createError = require('http-errors');

const {
  AIPlaygroundScenarios,
  AIPlaygroundRuns,
  LePatronSkills,
  Groups,
} = require('../../common/models.common.js');
const skillInvocation = require('../../ai-skill/services/skill-invocation.service.js');
const testBudget = require('../../ai-skill/services/test-budget.service.js');
const { resolveExpertise } = require('./expertise-resolver.service.js');
const {
  VersionRefModes,
  PlaygroundFeatureType,
} = require('../constant/playground-constants.js');

/**
 * Execute a scenario:
 *   1. Snapshot scenario (full deep copy).
 *   2. Resolve the skill version (active or pinned).
 *   3. Resolve expertises (3 modes: explicit / filter / none).
 *   4. Compose the input. v1 doctrine: the runner only auto-injects the
 *      `expertise` field. Everything else stays in scenario.input verbatim.
 *   5. Consume the user's daily test budget.
 *   6. Call skillInvocation.invoke({ ..., featureType: 'playground' }).
 *      The invoke service handles its own logging into AISkillInvocation.
 *   7. Persist an AIPlaygroundRun with the snapshot, refs and denormalised
 *      output for fast listing.
 *
 * @returns {Promise<AIPlaygroundRun>}
 */
async function executeScenario({
  scenarioId,
  userId,
  groupId,
  overrides = {},
}) {
  const scenario = await AIPlaygroundScenarios.findOne({ scenarioId });
  if (!scenario) throw createError(404, `Scenario "${scenarioId}" not found`);

  const snapshot = JSON.parse(JSON.stringify(scenario.toObject()));
  // Group resolution order: explicit runtime groupId > scenario.groupContext >
  // the internal platform group. The platform group lets the playground run as
  // a super-admin R&D engine without borrowing a client group's integration.
  let effectiveGroupId = groupId || scenario.groupContext;
  if (!effectiveGroupId) {
    const platformGroup = await Groups.findOne(
      { isPlatform: true },
      { _id: 1 }
    ).lean();
    if (!platformGroup) {
      throw createError(
        400,
        'No group context and no platform group found. Run ' +
          '`yarn flag-platform-group`, then configure its Skills engine ' +
          'in "Fonctionnalités IA".'
      );
    }
    effectiveGroupId = platformGroup._id;
  }

  const resolvedSkill = await loadActiveOrPinnedSkill(scenario.skillRef);
  const resolvedExpertise = await resolveExpertise(scenario);

  const baseInput =
    overrides.input !== undefined ? overrides.input : scenario.input || {};
  // The runner only auto-injects `expertise`, and ONLY when there is at least
  // one resolved expertise. Injecting an empty `expertise: []` would break
  // skills whose (strict) input schema doesn't declare an expertise field —
  // e.g. `generic.text`. A skill that consumes expertise must declare an
  // optional `expertise` field in its input schema. Everything else stays the
  // super-admin's responsibility on scenario.input.
  const composedInput = { ...baseInput };
  if (resolvedExpertise.length) {
    composedInput.expertise = resolvedExpertise.map((e) => ({
      expertiseId: e.expertiseId,
      title: e.title,
      body: e.body,
      examplesGood: e.examplesGood,
      examplesBad: e.examplesBad,
    }));
  }

  await testBudget.consumeBudget(userId);

  const invocationOptions = buildInvocationOptions(scenario, overrides);

  let invocationResult = null;
  let invocationError = null;
  try {
    invocationResult = await skillInvocation.invoke({
      skillId: resolvedSkill.skillId,
      input: composedInput,
      groupId: effectiveGroupId,
      userId,
      featureType: PlaygroundFeatureType,
      variantPath: scenario.variantPath || [],
      // Always pass the resolved version: in pinned mode this is what makes
      // the pinned version actually RUN (not just be displayed on the run).
      version: {
        major: resolvedSkill.versionMajor,
        minor: resolvedSkill.versionMinor,
      },
      options: invocationOptions,
    });
  } catch (err) {
    invocationError = err;
  }

  const run = await AIPlaygroundRuns.create({
    _scenario: scenario._id,
    scenarioSnapshot: snapshot,
    resolvedSkill: {
      skillId: resolvedSkill.skillId,
      versionMajor: resolvedSkill.versionMajor,
      versionMinor: resolvedSkill.versionMinor,
    },
    resolvedExpertise: resolvedExpertise.map((e) => ({
      expertiseId: e.expertiseId,
      versionMajor: e.versionMajor,
      versionMinor: e.versionMinor,
    })),
    composedInput,
    _invocation:
      (invocationResult && invocationResult.invocationId) ||
      (invocationError && invocationError.invocationId) ||
      null,
    output: invocationResult ? invocationResult.output : null,
    status: invocationError
      ? invocationError.invocationStatus || 'PROVIDER_ERROR'
      : 'SUCCESS',
    latencyMs: (invocationResult && invocationResult.latencyMs) || null,
    tokenUsage: (invocationResult && invocationResult.tokenUsage) || {},
    errorMessage: invocationError
      ? humanizeErrorMessage(invocationError)
      : null,
    createdBy: userId,
  });

  if (invocationError && invocationError.fieldErrors) {
    // Transient JS property, outside the mongoose schema: never persisted.
    // The execute controller copies it explicitly into the HTTP payload
    // (res.json would prune it through toJSON()).
    run.fieldErrors = invocationError.fieldErrors;
  }

  return run;
}

const FIELD_ISSUE_LABELS = {
  required: 'obligatoire',
  unrecognized: 'non reconnu par cette skill',
  length: 'longueur invalide',
  invalid: 'format invalide',
};

/**
 * Persisted errorMessage: when structured field errors exist, store a
 * human-readable summary instead of the raw zod message so historical failed
 * runs stay legible to consultants. Other error types keep their message.
 */
function humanizeErrorMessage(invocationError) {
  const fieldErrors = invocationError.fieldErrors;
  if (!Array.isArray(fieldErrors) || !fieldErrors.length) {
    return invocationError.message;
  }
  const parts = fieldErrors.map(
    (e) => `${e.field} (${FIELD_ISSUE_LABELS[e.issue] || e.issue})`
  );
  return `Champs invalides : ${parts.join(' ; ')}`;
}

async function loadActiveOrPinnedSkill(skillRef) {
  const skill = await LePatronSkills.findOne(
    { skillId: skillRef.skillId },
    { skillId: 1, status: 1, activeVersion: 1, versions: 1 }
  ).lean();
  if (!skill) throw createError(404, `Skill "${skillRef.skillId}" not found`);
  let major;
  let minor;
  if (skillRef.mode === VersionRefModes.PINNED) {
    major = skillRef.versionMajor;
    minor = skillRef.versionMinor || 0;
    const exists = (skill.versions || []).some(
      (v) => v.versionMajor === major && v.versionMinor === minor
    );
    if (!exists) {
      throw createError(
        404,
        `Version ${major}.${minor} of skill "${skillRef.skillId}" not found`
      );
    }
  } else {
    const av = skill.activeVersion || {};
    if (av.major == null) {
      throw createError(
        400,
        `Skill "${skillRef.skillId}" has no active version`
      );
    }
    major = av.major;
    minor = av.minor || 0;
  }
  return { skillId: skill.skillId, versionMajor: major, versionMinor: minor };
}

function buildInvocationOptions(scenario, overrides) {
  const opts = {};
  const po =
    (overrides && overrides.providerOverride) || scenario.providerOverride;
  if (!po) return opts;
  // The invocation service applies skill-modelHints; provider override is
  // surfaced for future use but not yet wired into invoke(). Kept as a
  // pass-through in `options.providerOverride` for forward compatibility.
  if (
    po.model ||
    po.temperature != null ||
    po.maxTokens != null ||
    po.topP != null
  ) {
    opts.providerOverride = {
      model: po.model || undefined,
      temperature: po.temperature,
      maxTokens: po.maxTokens,
      topP: po.topP,
    };
  }
  return opts;
}

module.exports = { executeScenario };

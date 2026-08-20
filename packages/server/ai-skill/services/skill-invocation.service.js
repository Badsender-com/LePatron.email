'use strict';

/**
 * Feature / Invocation / Skill — the conceptual contract
 * ------------------------------------------------------
 *   • Feature: a product capability (e.g. the textgen block button). It
 *     ORCHESTRATES and owns the skill-manifest. One feature → N invocations,
 *     potentially of DIFFERENT skills, each with its OWN expertise mix.
 *   • Invocation: one atomic call — exactly ONE skill (skillId is always a
 *     literal, never a dynamic selection) + one composed input. It is the unit
 *     of logging, cost and traceability (one AISkillInvocation row).
 *   • Composition lives in the FEATURE's code (ordering, chaining outputs,
 *     error handling) — a consequence of rejecting skill-to-skill invocation.
 *   • Expertise is loaded PER INVOCATION, not per feature: each invoke()
 *     receives an input already composed by the feature (via findApplicable
 *     with that invocation's own scope + categories).
 *
 * invocationSource convention
 * ---------------------------
 * Each AISkillInvocation log carries an `invocationSource` string that names
 * the caller. `'playground'` (invocations issued by the AI Playground module)
 * and the `'poc.*'` prefix are reserved for non-production traffic and excluded
 * from product analytics by default.
 *
 * Any other value is a productive feature (e.g. 'translation', 'qc.subject',
 * 'redaction.cta', …) declared by a skill manifest.
 */

const createError = require('http-errors');

const ProviderFactory = require('../../integration-providers/provider-factory.js');
const {
  LePatronSkills,
  AIFeatureConfigs,
  Integrations,
  Groups,
} = require('../../common/models.common.js');

const AIFeatureTypes = require('../../constant/ai-feature-type.js');
const { getSchema } = require('../schemas');
const { buildOutputContract } = require('../schemas/output-contract.js');
const {
  SkillStatuses,
  InvocationStatuses,
} = require('../constant/skill-constants.js');
const { resolveConfig } = require('./config-resolver.service.js');
const { buildFieldErrors } = require('./format-validation-error.js');
const {
  buildPrompt,
  parseJsonFromLLM,
} = require('./prompt-builder.service.js');
const {
  logInvocation,
  logFailure,
  formatZodError,
  callWithTimeout,
  truncate,
} = require('./invocation-logger.service.js');

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Invoke a skill with caller-supplied input. The service does NOT fetch
 * context (expertise, briefs, DSE) — that is the calling feature's job.
 * See PLAN-IMPLEMENTATION-V1 §4.2.
 *
 * ── Two orthogonal axes that must NEVER be conflated ──────────────────────
 *   • `invocationSource` (this param): the SOURCE of the invocation, for
 *     ANALYTICS only ('playground' | a productive feature name). Stored on
 *     AISkillInvocation and used to include/exclude rows from analytics. It does
 *     NOT influence which LLM engine is used.
 *   • [étape 2] `categoryOverride`: ENGINE RESOLUTION. Defaults to skill.category,
 *     overridable by the consuming feature. It selects which AIFeatureConfig
 *     featureType powers the call (redaction/qc/… → fallback 'skill'). See
 *     resolveGroupIntegration().
 *   The two used to share the name `featureType`, an invariant held by
 *   documentation alone; the distinct names are the invariant now.
 *
 * @param {Object} params
 * @param {string} params.skillId
 * @param {Object} params.input
 * @param {import('mongoose').Types.ObjectId | string} params.groupId
 * @param {import('mongoose').Types.ObjectId | string} [params.userId]
 * @param {string} [params.invocationSource] ANALYTICS source tag only — see contract above.
 * @param {string[]} [params.variantPath]
 * @param {{major: number, minor?: number}} [params.version] Pin a specific
 *   version instead of the active one (the playground's "pinned" mode). The
 *   skill itself must still be ACTIVE.
 * @param {Object} [params.options]
 * @param {boolean} [params.options.dryRun=false]
 * @param {boolean} [params.options.skipLogging=false] — internal flag for the test runner
 * @returns {Promise<{ output: any, invocationId: string, resolvedConfig: Object, tokenUsage: Object, latencyMs: number }>}
 */
async function invoke({
  skillId,
  input,
  groupId,
  userId,
  invocationSource,
  variantPath,
  version: versionRef,
  options = {},
}) {
  const startedAt = new Date();

  // ─── 1. Load the skill and pick the version (pinned or active) ─────────
  const skill = await LePatronSkills.findOne(
    { skillId, status: SkillStatuses.ACTIVE },
    {
      skillId: 1,
      activeVersion: 1,
      versions: 1,
    }
  );
  if (!skill) {
    throw createError(404, `Skill "${skillId}" not found or not ACTIVE`);
  }

  const activeRef = skill.activeVersion || {};
  const wantedMajor = versionRef ? versionRef.major : activeRef.major;
  const wantedMinor = versionRef ? versionRef.minor || 0 : activeRef.minor || 0;
  const version = (skill.versions || []).find(
    (v) => v.versionMajor === wantedMajor && v.versionMinor === wantedMinor
  );
  if (!version) {
    // A missing pinned version is the caller's mistake (404); a missing
    // active version is a data integrity bug (500).
    throw createError(
      versionRef ? 404 : 500,
      versionRef
        ? `Version ${wantedMajor}.${wantedMinor} of skill "${skillId}" not found`
        : `Skill "${skillId}" has activeVersion=${wantedMajor}.${wantedMinor} but the version is missing`
    );
  }

  // ─── 2. Validate input against zod schema (schemas live on the version) ──
  const inputSchema = getSchema(version.inputSchemaId);
  if (!inputSchema) {
    throw createError(
      500,
      `Skill "${skillId}" v${wantedMajor}.${wantedMinor} references unknown input schema "${version.inputSchemaId}"`
    );
  }
  // Checked here, next to the input schema, rather than where it is used at
  // step 6: an id that no longer resolves (schema renamed or removed in code
  // while a version still points at it) otherwise surfaced as a TypeError
  // *after* the provider call had been made and billed.
  if (!getSchema(version.outputSchemaId)) {
    throw createError(
      500,
      `Skill "${skillId}" v${wantedMajor}.${wantedMinor} references unknown output schema "${version.outputSchemaId}"`
    );
  }
  const inputParse = inputSchema.safeParse(input);
  if (!inputParse.success) {
    return logFailure({
      skill,
      version,
      groupId,
      userId,
      invocationSource,
      variantPath,
      input,
      startedAt,
      status: InvocationStatuses.VALIDATION_ERROR,
      error: {
        code: 'INPUT_VALIDATION',
        message: formatZodError(inputParse.error),
      },
      // Structured per-field errors for UI display. Top-level on purpose:
      // `error` is persisted as-is into AISkillInvocation.error (typed
      // subdoc) — fieldErrors only decorate the thrown error, transiently.
      fieldErrors: buildFieldErrors(inputParse.error, input),
      skipLogging: options.skipLogging,
    });
  }

  // ─── 3. Resolve provider config (Group > Skill > default) ──────────────
  const {
    integration,
    groupFeatureConfig,
    group,
  } = await resolveGroupIntegration(groupId);
  // Group-level content-logging opt-out — applies to success AND failure
  // paths below. (The INPUT_VALIDATION failure above happens before the
  // group is resolved; nothing was sent to a provider at that point.)
  const allowContent = group ? group.logSkillInvocationContent !== false : true;
  // Passed to every log call below so the TTL deadline is stamped without the
  // logger having to re-read the Group.
  const retentionDays = group ? group.logRetentionDays : undefined;
  const config = resolveConfig({
    integration,
    groupFeatureConfig,
    skillModelHints: version.modelHints || {},
    defaults: {},
  });

  // ─── 4. Build the prompt with random XML tags ──────────────────────────
  // The output-format contract is derived from the skill's outputSchemaId and
  // injected automatically — skill authors must not write it by hand.
  const { messages } = buildPrompt({
    version,
    input: inputParse.data,
    outputContract: buildOutputContract(version.outputSchemaId),
  });

  if (options.dryRun) {
    return {
      output: null,
      invocationId: null,
      resolvedConfig: config,
      tokenUsage: { promptTokens: 0, completionTokens: 0, cachedTokens: 0 },
      latencyMs: 0,
      messages,
    };
  }

  // ─── 5. Call the provider ──────────────────────────────────────────────
  const provider = ProviderFactory.createProvider(
    integration,
    groupFeatureConfig
  );
  // Native JSON mode when the provider guarantees it: LLMs hand-writing JSON
  // produce raw newlines / unescaped quotes inside long strings (two real QC
  // runs failed in OUTPUT_PARSE). The repair pass in parseJsonFromLLM stays as
  // defense-in-depth for providers without JSON mode.
  const responseFormat =
    typeof provider.supportsJsonResponseFormat === 'function' &&
    provider.supportsJsonResponseFormat()
      ? { type: 'json_object' }
      : undefined;
  let providerResponse;
  try {
    providerResponse = await callWithTimeout(
      provider.chatComplete({
        model: config.model,
        messages,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        responseFormat,
      }),
      options.timeoutMs || DEFAULT_TIMEOUT_MS
    );
  } catch (err) {
    const isTimeout = err && err.code === 'SKILL_TIMEOUT';
    return logFailure({
      skill,
      version,
      groupId,
      userId,
      invocationSource,
      variantPath,
      input: inputParse.data,
      startedAt,
      resolvedConfig: config,
      allowContent,
      retentionDays,
      status: isTimeout
        ? InvocationStatuses.TIMEOUT
        : InvocationStatuses.PROVIDER_ERROR,
      error: {
        code: err && err.code ? String(err.code) : 'PROVIDER_ERROR',
        message: err && err.message ? err.message : 'Provider call failed',
        stack: err && err.stack ? truncate(err.stack, 2000) : undefined,
      },
      skipLogging: options.skipLogging,
    });
  }

  // ─── 6. Parse + validate output ────────────────────────────────────────
  const outputSchema = getSchema(version.outputSchemaId);
  let parsedOutput;
  try {
    parsedOutput = parseJsonFromLLM(providerResponse.content);
  } catch (err) {
    return logFailure({
      skill,
      version,
      groupId,
      userId,
      invocationSource,
      variantPath,
      input: inputParse.data,
      rawOutput: providerResponse.content,
      startedAt,
      resolvedConfig: config,
      tokenUsage: providerResponse.usage,
      allowContent,
      retentionDays,
      status: InvocationStatuses.VALIDATION_ERROR,
      error: { code: 'OUTPUT_PARSE', message: err.message },
      skipLogging: options.skipLogging,
    });
  }

  const outputParse = outputSchema.safeParse(parsedOutput);
  if (!outputParse.success) {
    return logFailure({
      skill,
      version,
      groupId,
      userId,
      invocationSource,
      variantPath,
      input: inputParse.data,
      rawOutput: providerResponse.content,
      startedAt,
      resolvedConfig: config,
      tokenUsage: providerResponse.usage,
      allowContent,
      retentionDays,
      status: InvocationStatuses.VALIDATION_ERROR,
      error: {
        code: 'OUTPUT_VALIDATION',
        message: formatZodError(outputParse.error),
      },
      skipLogging: options.skipLogging,
    });
  }

  // ─── 7. Log success ────────────────────────────────────────────────────
  const completedAt = new Date();
  const latencyMs = completedAt - startedAt;

  const invocationId = await logInvocation({
    skill,
    version,
    groupId,
    userId,
    invocationSource,
    variantPath,
    input: inputParse.data,
    output: outputParse.data,
    rawOutput: providerResponse.content,
    resolvedConfig: config,
    tokenUsage: providerResponse.usage,
    startedAt,
    completedAt,
    latencyMs,
    status: InvocationStatuses.SUCCESS,
    allowContent,
    retentionDays,
    skipLogging: options.skipLogging,
  });

  return {
    output: outputParse.data,
    invocationId,
    resolvedConfig: config,
    tokenUsage: providerResponse.usage,
    latencyMs,
  };
}

/**
 * Resolve the Integration to use for a Group via the AIFeatureConfig.
 *
 * ENGINE RESOLUTION axis (NOT analytics — that is invoke()'s
 * `invocationSource` param). Today this resolves
 * the single generic 'skill' engine. [étape 2] it will take the skill's
 * category (or a caller `categoryOverride`) and resolve in cascade:
 *   category featureType (redaction/qc/…) → fallback 'skill' → CONFIG_ERROR.
 *
 * Throws a CONFIG_ERROR if not configured.
 */
function configError(status, message) {
  const err = createError(status, message);
  // Lets callers (the playground runner) persist the right run status
  // instead of defaulting to PROVIDER_ERROR.
  err.invocationStatus = InvocationStatuses.CONFIG_ERROR;
  return err;
}

async function resolveGroupIntegration(groupId) {
  const group = await Groups.findById(groupId).lean();
  if (!group) {
    throw configError(404, `Group ${groupId} not found`);
  }
  const featureConfig = await AIFeatureConfigs.findOne({
    _company: groupId,
  }).lean();
  if (!featureConfig) {
    throw configError(
      400,
      `Group ${groupId} has no AIFeatureConfig — configure a 'skill' integration`
    );
  }
  const skillFeature = (featureConfig.features || []).find(
    (f) => f.featureType === AIFeatureTypes.SKILL && f.isActive
  );
  if (!skillFeature || !skillFeature.integration) {
    throw configError(
      400,
      `Group ${groupId} has no active 'skill' feature configuration`
    );
  }
  const integration = await Integrations.findById(skillFeature.integration);
  if (!integration || !integration.isActive) {
    throw configError(
      400,
      `Integration ${skillFeature.integration} is missing or inactive`
    );
  }
  return {
    integration,
    groupFeatureConfig: skillFeature.config || {},
    group,
  };
}

module.exports = { invoke };

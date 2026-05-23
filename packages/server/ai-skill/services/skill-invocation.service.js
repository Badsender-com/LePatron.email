'use strict';

/**
 * featureType convention
 * -----------------------
 * Each AISkillInvocation log carries a `featureType` string that names the
 * caller. Two values are reserved for non-production traffic and should be
 * excluded from product analytics by default:
 *
 *   - 'admin-test'  → invocations triggered from the super-admin Test runner
 *                     (page detail of a skill > Test tab).
 *   - 'playground'  → invocations issued by the AI Playground module
 *                     (work-in-progress, see future work).
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
const {
  SkillStatuses,
  InvocationStatuses,
} = require('../constant/skill-constants.js');
const { resolveConfig } = require('./config-resolver.service.js');
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
 * @param {Object} params
 * @param {string} params.skillId
 * @param {Object} params.input
 * @param {import('mongoose').Types.ObjectId | string} params.groupId
 * @param {import('mongoose').Types.ObjectId | string} [params.userId]
 * @param {string} [params.featureType]
 * @param {string[]} [params.variantPath]
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
  featureType,
  variantPath,
  options = {},
}) {
  const startedAt = new Date();

  // ─── 1. Load the skill and its active version ──────────────────────────
  const skill = await LePatronSkills.findOne(
    { skillId, status: SkillStatuses.ACTIVE },
    {
      skillId: 1,
      activeVersion: 1,
      inputSchemaId: 1,
      outputSchemaId: 1,
      versions: 1,
    }
  );
  if (!skill) {
    throw createError(404, `Skill "${skillId}" not found or not ACTIVE`);
  }

  const activeRef = skill.activeVersion || {};
  const version = (skill.versions || []).find(
    (v) =>
      v.versionMajor === activeRef.major &&
      v.versionMinor === (activeRef.minor || 0)
  );
  if (!version) {
    throw createError(
      500,
      `Skill "${skillId}" has activeVersion=${activeRef.major}.${
        activeRef.minor || 0
      } but the version is missing`
    );
  }

  // ─── 2. Validate input against zod schema ──────────────────────────────
  const inputSchema = getSchema(skill.inputSchemaId);
  if (!inputSchema) {
    throw createError(
      500,
      `Skill "${skillId}" references unknown input schema "${skill.inputSchemaId}"`
    );
  }
  const inputParse = inputSchema.safeParse(input);
  if (!inputParse.success) {
    return logFailure({
      skill,
      version,
      groupId,
      userId,
      featureType,
      variantPath,
      input,
      startedAt,
      status: InvocationStatuses.VALIDATION_ERROR,
      error: {
        code: 'INPUT_VALIDATION',
        message: formatZodError(inputParse.error),
      },
      skipLogging: options.skipLogging,
    });
  }

  // ─── 3. Resolve provider config (Group > Skill > default) ──────────────
  const {
    integration,
    groupFeatureConfig,
    group,
  } = await resolveGroupIntegration(groupId);
  const config = resolveConfig({
    integration,
    groupFeatureConfig,
    skillModelHints: version.modelHints || {},
    defaults: {},
  });

  // ─── 4. Build the prompt with random XML tags ──────────────────────────
  const { messages } = buildPrompt({
    version,
    input: inputParse.data,
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
  let providerResponse;
  try {
    providerResponse = await callWithTimeout(
      provider.chatComplete({
        model: config.model,
        messages,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
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
      featureType,
      variantPath,
      input: inputParse.data,
      startedAt,
      resolvedConfig: config,
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
  const outputSchema = getSchema(skill.outputSchemaId);
  let parsedOutput;
  try {
    parsedOutput = parseJsonFromLLM(providerResponse.content);
  } catch (err) {
    return logFailure({
      skill,
      version,
      groupId,
      userId,
      featureType,
      variantPath,
      input: inputParse.data,
      rawOutput: providerResponse.content,
      startedAt,
      resolvedConfig: config,
      tokenUsage: providerResponse.usage,
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
      featureType,
      variantPath,
      input: inputParse.data,
      rawOutput: providerResponse.content,
      startedAt,
      resolvedConfig: config,
      tokenUsage: providerResponse.usage,
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
  const allowContent = group ? group.logSkillInvocationContent !== false : true;

  const invocationId = await logInvocation({
    skill,
    version,
    groupId,
    userId,
    featureType,
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
 * Resolve the Integration to use for a Group via the AIFeatureConfig with
 * featureType === 'skill'. Throws a CONFIG_ERROR if not configured.
 */
async function resolveGroupIntegration(groupId) {
  const group = await Groups.findById(groupId).lean();
  if (!group) {
    throw createError(404, `Group ${groupId} not found`);
  }
  const featureConfig = await AIFeatureConfigs.findOne({
    _company: groupId,
  }).lean();
  if (!featureConfig) {
    throw createError(
      400,
      `Group ${groupId} has no AIFeatureConfig — configure a 'skill' integration`
    );
  }
  const skillFeature = (featureConfig.features || []).find(
    (f) => f.featureType === AIFeatureTypes.SKILL && f.isActive
  );
  if (!skillFeature || !skillFeature.integration) {
    throw createError(
      400,
      `Group ${groupId} has no active 'skill' feature configuration`
    );
  }
  const integration = await Integrations.findById(skillFeature.integration);
  if (!integration || !integration.isActive) {
    throw createError(
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

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

const AIFeatureTypes = require('../../constant/ai-feature-type.js');
const ERROR_CODES = require('../../constant/error-codes.js');

const { getSchema } = require('../schemas');
const { buildOutputContract } = require('../schemas/output-contract.js');
const { InvocationStatuses } = require('../constant/skill-constants.js');
const { isAvailableTo } = require('./audience.js');
const { buildFieldErrors } = require('./format-validation-error.js');
const { buildPrompt } = require('./prompt-builder.service.js');
const {
  logFailure,
  formatZodError,
} = require('./invocation-logger.service.js');
const { readArguments } = require('./invocation-arguments.js');
const {
  loadSkillVersion,
  versionSchemas,
} = require('./skill-version-loader.js');
const {
  loadGroup,
  loggingPolicy,
  resolveEngine,
} = require('./invocation-engine.js');
const { runInvocation } = require('./invocation-run.js');

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
 *   • `featureType`: ENGINE RESOLUTION. The AIFeatureConfig entry whose
 *     integration and model power the call — 'skill' by default, the consuming
 *     feature's own type otherwise ('text_generation'). It says nothing about
 *     analytics. See resolveEngine() in invocation-engine.js.
 *   `featureType` once named the analytics tag too, an invariant held by
 *   documentation alone; the distinct names are the invariant now.
 *
 * @param {Object} params
 * @param {string} params.skillId
 * @param {Object} params.input
 * @param {import('mongoose').Types.ObjectId | string} params.groupId
 * @param {import('mongoose').Types.ObjectId | string} [params.userId]
 * @param {string} [params.invocationSource] ANALYTICS source tag only — see contract above.
 * @param {string} [params.featureType='skill'] ENGINE RESOLUTION: the
 *   AIFeatureConfig entry whose integration and model power the call. A client
 *   feature passes its own ('text_generation'), so a group opens it without
 *   opening every skill; the playground keeps the generic 'skill' engine.
 * @param {Array<{expertiseId: string, versionMajor: number, versionMinor: number}>} [params.expertiseConsumed]
 *   The expertise versions the caller composed into `input`. invoke() cannot
 *   tell them from the input (only ids and bodies travel there), so the caller
 *   says which versions it injected; they are logged for traceability.
 * @param {string[]} [params.variantPath]
 * @param {{major: number, minor?: number}} [params.version] Pin a specific
 *   version instead of the active one (the playground's "pinned" mode). The
 *   skill itself must still be ACTIVE.
 * @param {Object} [params.options]
 * @param {boolean} [params.options.dryRun=false]
 * @param {boolean} [params.options.skipLogging=false] — internal flag for the test runner
 * @param {boolean} [params.options.everyAudience=false] — use the skill whatever
 *   its audience, as the platform company does: the super admins' playground
 * @param {boolean} [params.options.unpublished=false] — also reach a skill
 *   never published yet, or archived, with a pinned version: the publication
 *   guard replays a feature skill before it is published (ADR 0019)
 * @returns {Promise<{ output: any, invocationId: string, resolvedConfig: Object, tokenUsage: Object, latencyMs: number }>}
 */
async function invoke({
  skillId,
  input,
  groupId,
  userId,
  invocationSource,
  featureType = AIFeatureTypes.SKILL,
  expertiseConsumed = [],
  variantPath,
  version: versionRef,
  options = {},
}) {
  const startedAt = new Date();
  const consumed = readArguments({ featureType, expertiseConsumed });
  const {
    skill,
    version,
    group,
    inputSchema,
    outputSchema,
  } = await resolveSkill({ skillId, versionRef, groupId, options });

  // What every log of this invocation records, whatever its outcome.
  const logged = {
    skill,
    version,
    groupId,
    userId,
    invocationSource,
    expertiseConsumed: consumed,
    variantPath,
    startedAt,
    skipLogging: options.skipLogging,
  };
  const validInput = await parseInput(inputSchema, input, logged);

  // The engine and its settings (Group > Skill > default).
  const engine = await resolveEngine({ groupId, featureType, version });
  // From here on something reaches a provider: the group's content opt-out
  // and retention apply to every log, success and failure alike.
  const attempt = {
    ...logged,
    input: validInput,
    resolvedConfig: engine.config,
    ...loggingPolicy(group),
  };

  // The prompt, with random XML tags. The output-format contract is derived from the skill's outputSchemaId and
  // injected automatically — skill authors must not write it by hand.
  const { messages } = buildPrompt({
    version,
    input: validInput,
    outputContract: buildOutputContract(version.outputSchemaId),
  });

  if (options.dryRun) {
    return {
      output: null,
      invocationId: null,
      resolvedConfig: engine.config,
      tokenUsage: { promptTokens: 0, completionTokens: 0, cachedTokens: 0 },
      latencyMs: 0,
      messages,
    };
  }
  return runInvocation({
    attempt,
    engine,
    messages,
    version,
    outputSchema,
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
  });
}

/**
 * The skill at the version pinned or active, which a skill
 * still proven by the platform company is not used on behalf of a client's
 * user (ADR 0013), and the schemas that version names.
 */
async function resolveSkill({ skillId, versionRef, groupId, options }) {
  const { skill, version } = await loadSkillVersion({
    skillId,
    versionRef,
    unpublished: options.unpublished,
  });
  const group = await loadGroup(groupId);
  if (!options.everyAudience && !isAvailableTo(skill, group)) {
    throw createError(403, ERROR_CODES.SKILL_NOT_AVAILABLE_TO_COMPANY);
  }
  return { skill, version, group, ...versionSchemas(skillId, version) };
}

/**
 * The input against the version's schema. A refused input is logged
 * and thrown; nothing has reached a provider yet.
 */
async function parseInput(inputSchema, input, logged) {
  const inputParse = inputSchema.safeParse(input);
  if (inputParse.success) return inputParse.data;
  return logFailure({
    ...logged,
    input,
    status: InvocationStatuses.VALIDATION_ERROR,
    error: {
      code: 'INPUT_VALIDATION',
      message: formatZodError(inputParse.error),
    },
    // Structured per-field errors for UI display. Top-level on purpose:
    // `error` is persisted as-is into AISkillInvocation.error (typed
    // subdoc) — fieldErrors only decorate the thrown error, transiently.
    fieldErrors: buildFieldErrors(inputParse.error, input),
  });
}

/**
 * Validate an input against a schema id, with the same message and per-field
 * errors `invoke()` would produce.
 *
 * Exists so a caller can reject an invalid input BEFORE spending anything it
 * cannot get back — the playground's daily quota. A zod failure triggers no
 * provider call and costs nothing, so it must not cost a run either. This is a
 * pre-flight, not a replacement: `invoke()` still validates.
 *
 * An unknown schema id is reported as valid on purpose — that is a
 * configuration error, and raising it is `invoke()`'s job (CONFIG_ERROR).
 *
 * @returns {{ ok: true } | { ok: false, message: string, fieldErrors: Array }}
 */
function validateInputAgainstSchema(schemaId, input) {
  const schema = getSchema(schemaId);
  if (!schema) return { ok: true };
  const parse = schema.safeParse(input);
  if (parse.success) return { ok: true };
  return {
    ok: false,
    message: formatZodError(parse.error),
    fieldErrors: buildFieldErrors(parse.error, input),
  };
}

module.exports = { invoke, validateInputAgainstSchema };

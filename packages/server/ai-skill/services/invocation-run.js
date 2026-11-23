'use strict';

const ProviderFactory = require('../../integration-providers/provider-factory.js');
const { buildOutputJsonSchema } = require('../schemas/output-contract.js');
const { InvocationStatuses } = require('../constant/skill-constants.js');
const { parseJsonFromLLM } = require('./prompt-builder.service.js');
const {
  logInvocation,
  logFailure,
  formatZodError,
  callWithTimeout,
  truncate,
} = require('./invocation-logger.service.js');

/**
 * The exchange with the engine: the call, the reading of its answer against
 * the skill's output contract, and the log of the outcome.
 */

/**
 * The call to the provider, ready to run. Building it is a configuration
 * step: a provider that cannot be created throws here, outside the call, and
 * is not recorded as a provider failure.
 *
 * @param {Object} params
 * @param {Object} params.integration
 * @param {Object} params.groupFeatureConfig
 * @param {Object} params.config the resolved model, temperature and max tokens
 * @param {Array} params.messages the built prompt
 * @param {string} params.outputSchemaId
 * @returns {(timeoutMs: number) => Promise<{ content: string, usage: Object }>}
 */
function prepareProviderCall({
  integration,
  groupFeatureConfig,
  config,
  messages,
  outputSchemaId,
}) {
  const provider = ProviderFactory.createProvider(
    integration,
    groupFeatureConfig
  );
  // Native JSON mode when the provider guarantees it: LLMs hand-writing JSON
  // produce raw newlines / unescaped quotes inside long strings (two real QC
  // runs failed in OUTPUT_PARSE). The repair pass in parseJsonFromLLM stays as
  // defense-in-depth for providers without JSON mode.
  // The schema rides along: providers that can enforce a shape rather than
  // ask for one need it (Anthropic decodes its answer against it). Those
  // that cannot simply ignore the extra field.
  const responseFormat =
    typeof provider.supportsJsonResponseFormat === 'function' &&
    provider.supportsJsonResponseFormat()
      ? { type: 'json_object', schema: buildOutputJsonSchema(outputSchemaId) }
      : undefined;
  return (timeoutMs) =>
    callWithTimeout(
      provider.chatComplete({
        model: config.model,
        messages,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        reasoningEffort: config.reasoningEffort,
        responseFormat,
      }),
      timeoutMs
    );
}

/**
 * A failed call, as the invocation log records it.
 *
 * @param {Error} err what the provider or the timeout threw
 * @returns {{ status: string, error: Object }}
 */
function providerFailure(err) {
  const isTimeout = err && err.code === 'SKILL_TIMEOUT';
  return {
    status: isTimeout
      ? InvocationStatuses.TIMEOUT
      : InvocationStatuses.PROVIDER_ERROR,
    error: {
      code: err && err.code ? String(err.code) : 'PROVIDER_ERROR',
      message: err && err.message ? err.message : 'Provider call failed',
      stack: err && err.stack ? truncate(err.stack, 2000) : undefined,
    },
  };
}

/**
 * The answer read against the output contract: the output, or why it is not
 * one (unparseable, or out of the schema).
 *
 * @param {string} content the provider's raw answer
 * @param {import('zod').ZodTypeAny} outputSchema
 * @returns {{ output: any } | { error: { code: string, message: string } }}
 */
function readOutput(content, outputSchema) {
  let parsed;
  try {
    parsed = parseJsonFromLLM(content);
  } catch (err) {
    return { error: { code: 'OUTPUT_PARSE', message: err.message } };
  }
  const outputParse = outputSchema.safeParse(parsed);
  if (!outputParse.success) {
    return {
      error: {
        code: 'OUTPUT_VALIDATION',
        message: formatZodError(outputParse.error),
      },
    };
  }
  return { output: outputParse.data };
}

/**
 * The call, its answer read against the output contract, and
 * the log of the outcome.
 */
async function runInvocation({
  attempt,
  engine,
  messages,
  version,
  outputSchema,
  timeoutMs,
}) {
  const runCall = prepareProviderCall({
    integration: engine.integration,
    groupFeatureConfig: engine.groupFeatureConfig,
    config: engine.config,
    messages,
    outputSchemaId: version.outputSchemaId,
  });
  let providerResponse;
  try {
    providerResponse = await runCall(timeoutMs);
  } catch (err) {
    return logFailure({ ...attempt, ...providerFailure(err) });
  }

  const answered = {
    ...attempt,
    rawOutput: providerResponse.content,
    tokenUsage: providerResponse.usage,
  };
  const read = readOutput(providerResponse.content, outputSchema);
  if (read.error) {
    return logFailure({
      ...answered,
      status: InvocationStatuses.VALIDATION_ERROR,
      error: read.error,
    });
  }

  const completedAt = new Date();
  const latencyMs = completedAt - attempt.startedAt;
  const invocationId = await logInvocation({
    ...answered,
    output: read.output,
    completedAt,
    latencyMs,
    status: InvocationStatuses.SUCCESS,
  });
  return {
    output: read.output,
    invocationId,
    resolvedConfig: engine.config,
    tokenUsage: providerResponse.usage,
    latencyMs,
  };
}

module.exports = { runInvocation };

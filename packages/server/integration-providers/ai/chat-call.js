'use strict';

const logger = require('../../utils/logger.js');
const { guardedFetch } = require('../provider-http.js');
const { readProviderError } = require('./provider-error-body.js');
const { toProviderError } = require('./provider-error-body.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');
const { callWithParamAdaptation } = require('./adaptive-chat-call.js');
const { quirkKey } = require('./param-quirks.js');

// Five minutes: long enough for a slow provider on a large batch, short enough
// that a wedged connection does not hold a request forever.
const CHAT_TIMEOUT_MS = 300000;
const CHAT_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Performing a chat completion: one attempt, and the loop that adapts the
 * request to what the model accepts.
 *
 * Split out of BaseLLMProvider, which was at the 300-line limit. Applied onto
 * the prototype like the translation and dialect mixins, so subclasses keep
 * overriding the hooks these call.
 */
const chatCallMethods = {
  /**
   * One attempt. Deliberately free of interpretation: it performs the request
   * and reports what came back, so the adaptation loop above owns the decision
   * of whether to replay.
   */
  async _attemptChatCompletion(requestBody, model, timeoutMs) {
    const providerName = this.getProviderType();
    // The timeout is node-fetch's own, not an AbortController cleared once the
    // headers are in: it also bounds the body read, which is where a slow
    // endpoint would otherwise hold the request forever.
    const response = await guardedFetch(this._getEndpointUrl(model), {
      method: 'POST',
      headers: this._buildHeaders(),
      body: JSON.stringify(requestBody),
      timeoutMs,
      maxBytes: CHAT_MAX_BYTES,
      label: `${providerName} API`,
    });

    if (response.ok) return { ok: true, data: await response.json() };

    const { parsedError, message } = await readProviderError(response);
    return { ok: false, status: response.status, parsedError, message };
  },

  async _callChatCompletionRaw({
    model,
    messages,
    temperature,
    maxTokens,
    responseFormat,
    reasoningEffort,
  }) {
    const providerName = this.getProviderType();
    logger.log(
      `Calling ${providerName} API with model:`,
      model,
      'at',
      this.baseUrl
    );

    const startTime = Date.now();

    try {
      const requestBody = this._buildRequestBody({
        model,
        messages,
        temperature,
        maxTokens,
        responseFormat,
        reasoningEffort,
      });

      // A refused parameter is corrected and replayed rather than raised: the
      // model list is fetched live, so it offers models whose contract this
      // code has never seen. One budget for the whole sequence — three
      // attempts must not mean three times the timeout.
      const { data, failure } = await callWithParamAdaptation({
        performAttempt: (body, timeoutMs) =>
          this._attemptChatCompletion(body, model, timeoutMs),
        body: requestBody,
        detect: (status, parsedError, message) =>
          this._detectParamQuirk(status, parsedError, message),
        key: quirkKey({
          providerType: providerName,
          baseUrl: this.baseUrl,
          model,
        }),
        deadlineAt: startTime + CHAT_TIMEOUT_MS,
        label: `${providerName}/${model}`,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (failure) {
        // Sanitised, not raw: this message is persisted on skill invocations
        // and shown to the user, not only logged.
        logger.error(
          `${providerName} API error:`,
          failure.status,
          failure.message
        );
        throw new ProviderError(
          `${providerName} API error: ${failure.status} - ${failure.message}`,
          this._mapErrorToCode(failure.status, failure.parsedError)
        );
      }

      // The request is handed over too: a dialect may have shaped it in a way
      // that changes how the answer must be read.
      const result = this._parseResponse(data, requestBody);

      // Truncation guarantees malformed JSON downstream, and the only trace
      // otherwise is a parse error blaming the model. Checked here rather than
      // per dialect: three dialects had three behaviours, and the one serving
      // six providers silently did nothing.
      if (this._getFinishReason(data) === 'length') {
        logger.error(
          `${providerName} response was truncated (output token limit reached)`,
          `model: ${model}`
        );
      }

      // Content length stays in the log: a response that arrives empty is
      // otherwise indistinguishable from a normal one here.
      logger.log(
        `${providerName} response received in ${elapsed}s - length: ${
          result.content ? result.content.length : 0
        } chars, tokens: ${result.usage.totalTokens || 'N/A'}`
      );

      return result;
    } catch (caught) {
      // Body reads fail as raw FetchErrors (size, timeout): typed like the
      // request itself, with no address in the message.
      const error =
        caught && caught.name === 'FetchError'
          ? toProviderError(caught, `${providerName} API`)
          : caught;
      if (error.code === CODES.TIMEOUT) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.error(
          `${providerName} API timeout after ${elapsed}s (limit: ${
            CHAT_TIMEOUT_MS / 1000
          }s)`
        );
        throw new ProviderError(
          `${providerName} API timeout - the request took too long.`,
          CODES.TIMEOUT
        );
      }
      throw error;
    }
  },
};

module.exports = { chatCallMethods, CHAT_TIMEOUT_MS, CHAT_MAX_BYTES };

'use strict';

const logger = require('../../utils/logger.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

/**
 * Translation behaviour shared by every LLM provider.
 *
 * Split out of BaseLLMProvider, which had grown past the 300-line limit and
 * was about to take on the request-shaping hooks the non-OpenAI dialects
 * need. The two concerns are genuinely separate: this one turns a batch of
 * strings into a prompt and reads JSON back, while the base class is about
 * speaking HTTP to a provider safely.
 *
 * Applied onto the prototype rather than layered as another class: providers
 * override `_buildTranslationPrompt` and `_getSystemPrompt` (Mistral does),
 * and keeping these as ordinary prototype methods leaves that untouched.
 */
const translationMethods = {
  async translateBatch({ texts, sourceLanguage, targetLanguage }) {
    const model = this.getDefaultTranslationModel();
    const sourceDesc =
      sourceLanguage === 'auto' ? 'the original language' : sourceLanguage;

    const prompt = this._buildTranslationPrompt({
      texts,
      sourceDesc,
      targetLanguage,
    });

    const completionOptions = {
      model,
      messages: [
        { role: 'system', content: this._getSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      // Translating a batch needs little reasoning, and a reasoning model
      // spends its thinking out of the same output budget and wall clock:
      // measured at twice gpt-4.1-mini's latency on gpt-5-mini's default
      // effort. `low` rather than `minimal`, which the o-series rejects.
      // Dialects without the notion ignore it.
      reasoningEffort: 'low',
    };

    if (this._supportsResponseFormat()) {
      completionOptions.responseFormat = { type: 'json_object' };
    }

    const response = await this._callChatCompletion(completionOptions);
    return this._parseTranslationResponse(response);
  },

  async translateText({ text, sourceLanguage, targetLanguage }) {
    const result = await this.translateBatch({
      texts: { text },
      sourceLanguage,
      targetLanguage,
    });
    return result.text;
  },

  _buildTranslationPrompt({ texts, sourceDesc, targetLanguage }) {
    const inputJson = JSON.stringify(texts, null, 2);
    logger.log(
      'Translation input - keys count:',
      Object.keys(texts).length,
      '- size:',
      inputJson.length,
      'chars'
    );

    return `Translate the following JSON object values from ${sourceDesc} to ${targetLanguage}.

IMPORTANT RULES:
1. Return ONLY a valid JSON object with the exact same keys
2. Translate only the values, never the keys
3. Preserve all dynamic variables exactly as they are:
   - %%VARIABLE%%, {{variable}}, <%=variable%>, @[variable]
4. Do not translate URLs or email addresses
5. Do not add any explanation, comments or markdown - just the JSON object

INPUT JSON:
${inputJson}

OUTPUT (valid JSON only):`;
  },

  _getSystemPrompt() {
    return 'You are a JSON translation API. You receive a JSON object and return the same JSON object with translated values. You MUST return valid JSON only, no markdown, no explanation. Keep the exact same structure and keys.';
  },

  _parseTranslationResponse(responseContent) {
    const providerName = this.getProviderType();
    try {
      if (!responseContent) {
        logger.error(`${providerName} returned empty response`);
        throw new ProviderError(
          `Empty response from ${providerName}`,
          CODES.INVALID_RESPONSE
        );
      }

      logger.log(
        `${providerName} raw response (first 500 chars):`,
        responseContent.substring(0, 500)
      );

      // Extract JSON from markdown code fences if present (e.g. ```json ... ```)
      const codeFenceMatch = responseContent.match(
        /```(?:json)?\s*\n?([\s\S]*?)```/i
      );
      const cleanedContent = (codeFenceMatch
        ? codeFenceMatch[1]
        : responseContent
      ).trim();

      return JSON.parse(cleanedContent);
    } catch (error) {
      // Log truncated response to avoid leaking sensitive data
      const truncated = responseContent
        ? responseContent.substring(0, 200) + '...'
        : '[empty]';
      logger.error(`Failed to parse ${providerName} response:`, truncated);
      throw new ProviderError(
        `Failed to parse translation response: ${error.message}`,
        CODES.INVALID_RESPONSE
      );
    }
  },
};

module.exports = { translationMethods };

'use strict';

const BaseLLMProvider = require('./base-llm-provider');
const { fetchProviderJson } = require('../provider-http.js');

const DEFAULT_API_HOST = 'https://api.openai.com';

// The newer chat-completions contract: `max_completion_tokens` instead of
// `max_tokens`, and no temperature other than the model's own default.
// Verified against a live account — gpt-4o and gpt-4.1 still accept both,
// gpt-5 and the o-series do not. The listing carries no metadata saying
// which, so the model name is the only signal available.
//
// Read as a generation number rather than a list of names. The literal
// pattern this replaces (`/^(gpt-5|o\d)/`) is what let `gpt-6-astra` through
// to staging, and a literal pattern would have missed gpt-7 the same way.
// Every generation since gpt-5 has kept the newer contract, so the useful
// question is "at least 5?", not "which names do I know?".
//
// A guess, and a safe one: if a future generation went back, the adaptation
// layer renames the parameter the other way round — its table is symmetric —
// and the conformance script reports it. Being wrong here costs one refused
// request per model, never a broken feature.
const NEW_CONTRACT_GENERATION = 5;
const GPT_GENERATION = /^gpt-(\d+)/;
const REASONING_SERIES = /^o\d/;
/**
 * OpenAI provider implementation
 */
class OpenAIProvider extends BaseLLMProvider {
  // OpenAI-compatible JSON mode: guarantees syntactically valid JSON output.
  supportsJsonResponseFormat() {
    return true;
  }

  constructor(integration) {
    super(integration);
    this.baseUrl = this.apiHost || DEFAULT_API_HOST;
  }

  /**
   * Whether the model speaks the newer contract. Read from the name, the only
   * signal a model id carries; subclasses whose "model" is a name the
   * customer chose (Azure deployments) add their own.
   *
   * A fast path, not a contract. The source of truth is what the provider
   * answers: a model this pattern does not recognise is corrected on the fly
   * by the adaptation layer (adaptive-chat-call.js) and the correction is
   * remembered. `gpt-6-astra` reached staging and failed because this pattern
   * was the only thing deciding, which is no longer the case.
   *
   * Widened once already, on what the conformance script reported: the whole
   * gpt-6 family adapted on every call, on both paths. Widen it again the
   * same way — on a sweep that names the family, never blind.
   */
  _isNewContractModel(model) {
    const id = model || '';
    if (REASONING_SERIES.test(id)) return true;

    const generation = GPT_GENERATION.exec(id);
    return generation
      ? Number(generation[1]) >= NEW_CONTRACT_GENERATION
      : false;
  }

  _maxTokensParamName(model) {
    return this._isNewContractModel(model)
      ? 'max_completion_tokens'
      : 'max_tokens';
  }

  _supportsTemperature(model) {
    return !this._isNewContractModel(model);
  }

  // Same families: the reasoning models are the ones on the newer contract.
  _supportsReasoningEffort(model) {
    return this._isNewContractModel(model);
  }

  /**
   * OpenAI lists every model family at once — embeddings, TTS, whisper, image
   * and moderation models alongside the chat ones — with no field saying
   * which is which. The noise filter lives in the catalogue rather than here,
   * so the rules sit next to the curated entries they defer to.
   */
  async listRemoteModels() {
    const payload = await fetchProviderJson(`${this.baseUrl}/v1/models`, {
      headers: this._buildHeaders(),
      label: `${this.getProviderType()} models listing`,
      mapErrorToCode: (status) => this._mapErrorToCode(status),
    });

    // `shutdown_date` is OpenAI telling us when a model goes away. It is the
    // only usable metadata here — the listing carries no description and no
    // pricing — and it saves us from curating a list of dead models by hand.
    return (payload.data || []).map((model) => ({
      id: model.id,
      shutdownDate: model.shutdown_date || null,
    }));
  }
}

module.exports = OpenAIProvider;

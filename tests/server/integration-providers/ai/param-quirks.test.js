'use strict';

const {
  detectParamQuirk,
  applyQuirks,
  quirkKey,
} = require('../../../../packages/server/integration-providers/ai/param-quirks');

// Bodies copied from real refusals, not invented: the whole mechanism rests on
// the provider naming the parameter, so the shape has to be the real one.
const REFUSED_MAX_TOKENS = {
  error: {
    message:
      "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
    type: 'invalid_request_error',
    param: 'max_tokens',
    code: 'unsupported_parameter',
  },
};

const REFUSED_TEMPERATURE = {
  error: {
    message:
      "Unsupported value: 'temperature' does not support 0.3 with this model.",
    type: 'invalid_request_error',
    param: 'temperature',
    code: 'unsupported_value',
  },
};

describe('detectParamQuirk', () => {
  describe('what it adapts', () => {
    it('renames the token limit when the model wants the newer name', () => {
      expect(detectParamQuirk(400, REFUSED_MAX_TOKENS)).toEqual({
        param: 'max_tokens',
        action: 'rename',
        to: 'max_completion_tokens',
      });
    });

    // An OpenAI-compatible gateway can be behind on the same id.
    it('renames the other way round too', () => {
      const body = {
        error: {
          param: 'max_completion_tokens',
          code: 'unsupported_parameter',
        },
      };

      expect(detectParamQuirk(400, body)).toEqual({
        param: 'max_completion_tokens',
        action: 'rename',
        to: 'max_tokens',
      });
    });

    it('drops a refused temperature', () => {
      expect(detectParamQuirk(400, REFUSED_TEMPERATURE)).toEqual({
        param: 'temperature',
        action: 'drop',
      });
    });

    // Infomaniak answers 422 where OpenAI answers 400.
    it('accepts a 422 as a refusal', () => {
      expect(detectParamQuirk(422, REFUSED_TEMPERATURE)).toMatchObject({
        param: 'temperature',
      });
    });

    // Older models cap completions well below our default, and the
    // translation path sends that default because it passes none of its own —
    // so gpt-4-turbo could not translate at all. The provider names the
    // ceiling, which is what makes clamping safe rather than a guess.
    it('clamps a token limit the model says is too large', () => {
      const body = {
        error: {
          message:
            'max_tokens is too large: 16000. This model supports at most 4096 completion tokens.',
          param: 'max_tokens',
          code: 'invalid_value',
        },
      };

      expect(detectParamQuirk(400, body)).toEqual({
        param: 'max_tokens',
        action: 'clamp',
        value: 4096,
      });
    });

    it('ignores an invalid_value it cannot read a ceiling from', () => {
      const body = {
        error: {
          message: 'temperature must be between 0 and 2',
          param: 'temperature',
          code: 'invalid_value',
        },
      };

      expect(detectParamQuirk(400, body)).toBeNull();
    });

    it('falls back to the message when the payload names no param', () => {
      const body = {
        error: {
          message:
            "Unsupported parameter: 'max_tokens' is not supported with this model.",
          code: 'unsupported_parameter',
        },
      };

      expect(detectParamQuirk(400, body, body.error.message)).toMatchObject({
        param: 'max_tokens',
      });
    });
  });

  // This is the safety property: anything not explicitly adaptable is left
  // alone, so a real misconfiguration surfaces instead of being retried into
  // something else.
  describe('what it refuses to touch', () => {
    it.each([
      [
        'a parameter outside the closed list',
        400,
        { error: { param: 'messages', code: 'unsupported_parameter' } },
      ],
      [
        'an unknown error code',
        400,
        { error: { param: 'max_tokens', code: 'model_not_found' } },
      ],
      [
        'no param and no usable message',
        400,
        { error: { code: 'unsupported_parameter' } },
      ],
      ['an empty body', 400, {}],
      ['a null body', 400, null],
    ])('returns null for %s', (_label, status, body) => {
      expect(detectParamQuirk(status, body)).toBeNull();
    });

    it.each([
      ['unauthorized', 401],
      ['forbidden', 403],
      ['rate limited', 429],
      ['server error', 500],
      ['gateway error', 502],
    ])('never adapts on %s', (_label, status) => {
      expect(detectParamQuirk(status, REFUSED_MAX_TOKENS)).toBeNull();
    });

    // Anthropic and Gemini word their refusals differently; the message
    // patterns are anchored on OpenAI's so they fall through rather than
    // matching by accident.
    it.each([
      ['Anthropic', 'temperature: Extra inputs are not permitted'],
      ['Gemini', 'Invalid JSON payload received. Unknown name "temperature".'],
    ])('does not match a %s message', (_label, message) => {
      expect(detectParamQuirk(400, { error: { message } }, message)).toBeNull();
    });
  });
});

describe('applyQuirks', () => {
  it('renames while keeping the value', () => {
    const body = { model: 'm', max_tokens: 1024 };

    expect(
      applyQuirks(body, [
        { param: 'max_tokens', action: 'rename', to: 'max_completion_tokens' },
      ])
    ).toEqual({ model: 'm', max_completion_tokens: 1024 });
  });

  it('drops without leaving a trace', () => {
    expect(
      applyQuirks({ model: 'm', temperature: 0.3 }, [
        { param: 'temperature', action: 'drop' },
      ])
    ).toEqual({ model: 'm' });
  });

  // The translation path hits both in sequence.
  it('applies several quirks at once', () => {
    const body = { model: 'm', max_tokens: 1024, temperature: 0.3 };

    expect(
      applyQuirks(body, [
        { param: 'max_tokens', action: 'rename', to: 'max_completion_tokens' },
        { param: 'temperature', action: 'drop' },
      ])
    ).toEqual({ model: 'm', max_completion_tokens: 1024 });
  });

  it('leaves the original body untouched', () => {
    const body = { model: 'm', temperature: 0.3 };

    applyQuirks(body, [{ param: 'temperature', action: 'drop' }]);

    expect(body).toEqual({ model: 'm', temperature: 0.3 });
  });

  it('clamps down to the stated ceiling', () => {
    expect(
      applyQuirks({ model: 'm', max_tokens: 16000 }, [
        { param: 'max_tokens', action: 'clamp', value: 4096 },
      ])
    ).toEqual({ model: 'm', max_tokens: 4096 });
  });

  // A stale ceiling must never raise a request.
  it('never clamps upwards', () => {
    expect(
      applyQuirks({ model: 'm', max_tokens: 500 }, [
        { param: 'max_tokens', action: 'clamp', value: 4096 },
      ])
    ).toEqual({ model: 'm', max_tokens: 500 });
  });

  it('ignores a quirk for a parameter that is not there', () => {
    expect(
      applyQuirks({ model: 'm' }, [{ param: 'temperature', action: 'drop' }])
    ).toEqual({
      model: 'm',
    });
  });
});

describe('quirkKey', () => {
  // Keyed on the model at this host: what one group discovers helps the next.
  it('is the same for two integrations on the same host and model', () => {
    const a = quirkKey({
      providerType: 'openai',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-6-astra',
    });
    const b = quirkKey({
      providerType: 'openai',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-6-astra',
    });

    expect(a).toBe(b);
  });

  // The same id can be served under a different contract elsewhere.
  it('separates two hosts serving the same model id', () => {
    expect(
      quirkKey({
        providerType: 'openai_compatible',
        baseUrl: 'https://a.example',
        model: 'gpt-6-astra',
      })
    ).not.toBe(
      quirkKey({
        providerType: 'openai_compatible',
        baseUrl: 'https://b.example',
        model: 'gpt-6-astra',
      })
    );
  });
});

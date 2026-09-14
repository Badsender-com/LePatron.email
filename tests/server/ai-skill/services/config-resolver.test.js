'use strict';

const {
  resolveConfig,
} = require('../../../../packages/server/ai-skill/services/config-resolver.service');

describe('config-resolver', () => {
  const integration = { provider: 'openai' };

  it('reads provider from the Group integration', () => {
    const cfg = resolveConfig({ integration });
    expect(cfg.provider).toBe('openai');
    expect(cfg.source.provider).toBe('group');
  });

  it('model: Group > Skill > default', () => {
    const cfg = resolveConfig({
      integration,
      groupFeatureConfig: { model: 'gpt-4o' },
      skillModelHints: { model: 'gpt-4o-mini' },
      defaults: { model: 'gpt-3.5' },
    });
    expect(cfg.model).toBe('gpt-4o');
    expect(cfg.source.model).toBe('group');
  });

  it('model: falls back to skill when group not set', () => {
    const cfg = resolveConfig({
      integration,
      skillModelHints: { model: 'gpt-4o-mini' },
      defaults: { model: 'gpt-3.5' },
    });
    expect(cfg.model).toBe('gpt-4o-mini');
    expect(cfg.source.model).toBe('skill');
  });

  it('model: falls back to default when neither set', () => {
    const cfg = resolveConfig({
      integration,
      defaults: { model: 'gpt-3.5' },
    });
    expect(cfg.model).toBe('gpt-3.5');
    expect(cfg.source.model).toBe('default');
  });

  it('temperature: Skill > Group > default (opposite priority to model)', () => {
    const cfg = resolveConfig({
      integration,
      groupFeatureConfig: { temperature: 0.1 },
      skillModelHints: { temperature: 0.7 },
    });
    expect(cfg.temperature).toBe(0.7);
    expect(cfg.source.temperature).toBe('skill');
  });

  it('temperature: falls back to Group when skill not set', () => {
    const cfg = resolveConfig({
      integration,
      groupFeatureConfig: { temperature: 0.1 },
    });
    expect(cfg.temperature).toBe(0.1);
    expect(cfg.source.temperature).toBe('group');
  });

  it('maxTokens & topP follow the same Skill > Group > default rule', () => {
    const cfg = resolveConfig({
      integration,
      groupFeatureConfig: { maxTokens: 1000, topP: 0.9 },
      skillModelHints: { maxTokens: 500 },
    });
    expect(cfg.maxTokens).toBe(500);
    expect(cfg.source.maxTokens).toBe('skill');
    expect(cfg.topP).toBe(0.9);
    expect(cfg.source.topP).toBe('group');
  });
});

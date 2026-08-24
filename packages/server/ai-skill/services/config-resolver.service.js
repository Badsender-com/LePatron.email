'use strict';

/**
 * Resolve the effective LLM configuration for an invocation.
 *
 * Priority (from PLAN §4.2):
 *   - provider      → Group > Skill > default
 *   - model         → Group > Skill > default
 *   - temperature   → Skill > Group > default
 *   - maxTokens     → Skill > Group > default
 *   - topP          → Skill > Group > default
 *
 * @param {Object} params
 * @param {Object} params.integration              Group's resolved Integration (provider + apiKey).
 * @param {Object} [params.groupFeatureConfig]     `AIFeatureConfig.features[?].config` for the Group.
 * @param {Object} [params.skillModelHints]        `skill.versions[active].modelHints`.
 * @param {Object} [params.defaults]               System defaults.
 * @returns {{ provider: string, model: string, temperature?: number, maxTokens?: number, topP?: number, source: Object }}
 */
function resolveConfig({
  integration,
  groupFeatureConfig = {},
  skillModelHints = {},
  defaults = {},
}) {
  const groupCfg = groupFeatureConfig || {};
  const skillCfg = skillModelHints || {};
  const def = defaults || {};

  const provider = pick([[integration.provider, 'group']]);

  const { value: model, source: modelSource } = pickWithSource([
    [groupCfg.model, 'group'],
    [skillCfg.model, 'skill'],
    [def.model, 'default'],
  ]);

  const { value: temperature, source: temperatureSource } = pickWithSource([
    [skillCfg.temperature, 'skill'],
    [groupCfg.temperature, 'group'],
    [def.temperature, 'default'],
  ]);

  const { value: maxTokens, source: maxTokensSource } = pickWithSource([
    [skillCfg.maxTokens, 'skill'],
    [groupCfg.maxTokens, 'group'],
    [def.maxTokens, 'default'],
  ]);

  const { value: topP, source: topPSource } = pickWithSource([
    [skillCfg.topP, 'skill'],
    [groupCfg.topP, 'group'],
    [def.topP, 'default'],
  ]);

  return {
    provider,
    model,
    temperature,
    maxTokens,
    topP,
    source: {
      provider: 'group',
      model: modelSource,
      temperature: temperatureSource,
      maxTokens: maxTokensSource,
      topP: topPSource,
    },
  };
}

function pick(pairs) {
  for (const [value] of pairs) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function pickWithSource(pairs) {
  for (const [value, source] of pairs) {
    if (value !== undefined && value !== null) return { value, source };
  }
  return { value: undefined, source: null };
}

module.exports = { resolveConfig };

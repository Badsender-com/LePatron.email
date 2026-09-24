'use strict';

const {
  providerConfigs,
} = require('../../../packages/ui/components/integrations/provider-configs');
const {
  validateIntegrationConfig,
} = require('../../../packages/server/integration/integration.validation');

// The form sends these settings as booleans; the server refuses any key a
// provider does not read. A switch the server does not know would make every
// save of that integration fail.
describe('integration config switches', () => {
  const withSwitches = Object.entries(providerConfigs).filter(
    ([, config]) => (config.configFields || []).length > 0
  );

  it('exist for at least Azure and the OpenAI-compatible endpoints', () => {
    expect(withSwitches.map(([provider]) => provider)).toEqual(
      expect.arrayContaining(['azure_openai', 'openai_compatible'])
    );
  });

  it.each(withSwitches)(
    '%s: every switch is accepted by the server',
    (provider, config) => {
      for (const field of config.configFields) {
        for (const checked of [true, false]) {
          expect(() =>
            validateIntegrationConfig(provider, { [field.key]: checked })
          ).not.toThrow();
        }
      }
    }
  );
});

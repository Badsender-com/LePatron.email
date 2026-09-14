'use strict';

const mongoose = require('mongoose');
const ScenarioSchema = require('../../../../packages/server/ai-playground/models/ai-playground-scenario.schema');

const Model =
  mongoose.models.__TestPlaygroundScenario ||
  mongoose.model('__TestPlaygroundScenario', ScenarioSchema);

function build(overrides = {}) {
  return new Model({
    scenarioId: 'demo.scenario',
    name: 'Demo',
    skillRef: { skillId: 'generic.text', mode: 'active' },
    ...overrides,
  });
}

describe('AIPlaygroundScenario model', () => {
  it('validates a minimal scenario', async () => {
    await expect(build().validate()).resolves.toBeUndefined();
  });

  it('rejects scenarioId with bad chars', async () => {
    await expect(build({ scenarioId: 'Bad ID!' }).validate()).rejects.toThrow(
      /scenarioId/
    );
  });

  it('rejects a pinned skillRef without versionMajor', async () => {
    await expect(
      build({ skillRef: { skillId: 's', mode: 'pinned' } }).validate()
    ).rejects.toThrow(/pinned/);
  });

  it('accepts pinned skillRef with version', async () => {
    await expect(
      build({
        skillRef: {
          skillId: 's',
          mode: 'pinned',
          versionMajor: 1,
          versionMinor: 0,
        },
      }).validate()
    ).resolves.toBeUndefined();
  });

  it('rejects pinned expertiseRef without versionMajor', async () => {
    await expect(
      build({
        expertiseRefs: [{ expertiseId: 'e', mode: 'pinned' }],
      }).validate()
    ).rejects.toThrow(/pinned/);
  });
});

'use strict';

const {
  scanInvocations,
  loadManifests,
  declaredIdsOf,
} = require('../../../scripts/check-skill-usage');

describe('check-skill-usage script', () => {
  it('loadManifests picks up the translation squelette', () => {
    const manifests = loadManifests();
    const translation = manifests.find(
      (m) => m.manifest.featureType === 'translation'
    );
    expect(translation).toBeDefined();
    expect(Array.isArray(translation.manifest.usedSkills)).toBe(true);
  });

  it('scanInvocations does not pick up the service file itself (excluded)', () => {
    const map = scanInvocations();
    // No real production caller exists yet → empty map. This test mostly
    // guards against accidentally regressing the exclusion (which would
    // produce false-positive undeclared invocations on every run).
    expect(map.size).toBe(0);
  });

  it('declaredIdsOf reads a skill named by its id or as an object', () => {
    const { skillIds } = declaredIdsOf([
      { manifest: { usedSkills: ['translate-email'] } },
      { manifest: { usedSkills: [{ skillId: 'generate-subject' }] } },
    ]);

    expect([...skillIds]).toEqual(['translate-email', 'generate-subject']);
  });
});

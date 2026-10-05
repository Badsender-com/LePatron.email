'use strict';

const {
  scanInvocations,
  loadManifests,
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

  it('scanInvocations finds the production callers, never the service file itself', () => {
    const map = scanInvocations();
    // Text generation is the first production caller (epic #1163). The
    // exclusion still matters: the service's own `invoke` would otherwise read
    // as an undeclared invocation on every run.
    expect(map.get('redaction.objet')).toEqual([
      expect.stringMatching(
        /text-generation[\\/]text-generation\.service\.js$/
      ),
    ]);
    const files = [...map.values()].flat();
    expect(files.some((file) => /ai-skill[\\/]services/.test(file))).toBe(
      false
    );
  });
});

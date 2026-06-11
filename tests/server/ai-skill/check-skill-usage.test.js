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

  it('scanInvocations finds the declared call sites and nothing else', () => {
    const map = scanInvocations();
    // First real feature caller: the email-builder textgen POC. Every scanned
    // skillId must be covered by a manifest — and the invoke service itself
    // must stay excluded from the scan (no false positives).
    expect([...map.keys()]).toEqual(['redaction.block.promo']);

    const manifests = loadManifests();
    const declared = manifests.flatMap((m) =>
      (m.manifest.usedSkills || []).map((s) => s.skillId)
    );
    expect(declared).toContain('redaction.block.promo');
  });
});

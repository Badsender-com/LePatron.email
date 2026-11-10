'use strict';

// A new skill or expertise starts with the platform company (ADR 0013). One
// stored before audiences has none, and must keep none through a load and a
// save, until the migration opens it: a default set on load would close it to
// the clients for good. Real Mongoose models, since the fakes apply no default.

const mongoose = require('mongoose');
const LePatronSkillSchema = require('../../../../packages/server/ai-skill/models/le-patron-skill.schema');
const ExpertiseSchema = require('../../../../packages/server/ai-skill/models/expertise.schema');

const modelOf = (name, schema) =>
  mongoose.models[name] || mongoose.model(name, schema);

const SkillModel = modelOf('__TestAudienceSkill', LePatronSkillSchema);
const ExpertiseModel = modelOf('__TestAudienceExpertise', ExpertiseSchema);

const stored = {
  title: 'Stored before audiences',
  category: 'redaction',
  status: 'ACTIVE',
  activeVersion: { major: 1, minor: 0 },
  versions: [{ versionMajor: 1, versionMinor: 0, status: 'ACTIVE' }],
};

// What the next save would write.
const setOnSave = (doc) => {
  const delta = doc.$__delta();
  return (delta && delta[1] && delta[1].$set) || {};
};

describe.each([
  ['a skill', SkillModel, { skillId: 'redaction.stored' }],
  ['an expertise', ExpertiseModel, { expertiseId: 'redaction.stored' }],
])('the audience of %s', (_label, Model, key) => {
  it('is the platform company once created', () => {
    const doc = new Model({ ...stored, ...key });

    expect(doc.audience).toBe('platform');
  });

  it('stays unset on one stored without it, loaded then saved', () => {
    const doc = Model.hydrate({
      _id: new mongoose.Types.ObjectId(),
      ...stored,
      ...key,
    });
    doc.title = 'Renamed';

    expect(doc.audience).toBeUndefined();
    expect(setOnSave(doc)).toMatchObject({ title: 'Renamed' });
    expect(setOnSave(doc)).not.toHaveProperty('audience');
  });

  it('keeps the one it was stored with', () => {
    const doc = Model.hydrate({
      _id: new mongoose.Types.ObjectId(),
      ...stored,
      ...key,
      audience: 'all',
    });

    expect(doc.audience).toBe('all');
  });
});

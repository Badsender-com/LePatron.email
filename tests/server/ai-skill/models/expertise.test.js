'use strict';

const mongoose = require('mongoose');
const ExpertiseSchema = require('../../../../packages/server/ai-skill/models/expertise.schema');

const ExpertiseModel =
  mongoose.models.__TestExpertise ||
  mongoose.model('__TestExpertise', ExpertiseSchema);

function buildExpertise(overrides = {}) {
  return new ExpertiseModel({
    expertiseId: 'redaction.cta.principles',
    title: 'Principes CTA',
    category: 'redaction',
    versions: [
      {
        versionMajor: 1,
        versionMinor: 0,
        body: '## [urgency] Urgence\nContenu.\n## [verbs] Verbes\nAutres.',
      },
    ],
    ...overrides,
  });
}

describe('Expertise model', () => {
  it('validates and auto-derives sections from the body', async () => {
    const exp = buildExpertise();
    await expect(exp.validate()).resolves.toBeUndefined();
    const ids = exp.versions[0].sections.map((s) => s.id);
    expect(Array.from(ids)).toEqual(['urgency', 'verbs']);
  });

  it('rejects when the body contains duplicate section ids', async () => {
    const exp = buildExpertise({
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          body: '## [dup] A\n## [dup] B',
        },
      ],
    });
    await expect(exp.validate()).rejects.toThrow(/Duplicate/);
  });

  it('rejects when a section id is not a valid slug', async () => {
    const exp = buildExpertise({
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          body: '## [Bad ID] X',
        },
      ],
    });
    await expect(exp.validate()).rejects.toThrow(/slug/);
  });

  it('rejects an expertiseId not matching the regex', async () => {
    const exp = buildExpertise({ expertiseId: 'Bad ID!' });
    await expect(exp.validate()).rejects.toThrow(/expertiseId/);
  });

  it('defaults status to DRAFT', () => {
    expect(buildExpertise().status).toBe('DRAFT');
  });

  it('accepts a body without H2 sections', async () => {
    const exp = buildExpertise({
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          body: 'Just paragraphs, no headings.',
        },
      ],
    });
    await expect(exp.validate()).resolves.toBeUndefined();
    expect(exp.versions[0].sections.length).toBe(0);
  });
});

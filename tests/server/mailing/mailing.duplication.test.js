'use strict';

// There are THREE ways to duplicate a mailing, each with its own mechanics:
//   1. MailingSchema.methods.duplicate  — mutates the document in place
//   2. mailingService.copyMailing       — through the shared buildMailingCopy
//   3. duplicateWithTranslatedData      — through the same buildMailingCopy
//
// The metadata rule is the same on all three: `subject` and `_emailType` describe
// the email and follow the copy, `plannedSendDate` belongs to one campaign and
// must not be inherited — a copy silently carrying yesterday's send date is a
// planning bug nobody would look for. None of the three had a test before.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: {},
  Workspaces: {},
  Galleries: {},
  Folders: {},
  Groups: {},
  Templates: {},
  TaxonomyItems: {},
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');

const MailingSchema = require('../../../packages/server/mailing/mailing.schema.js');
const {
  buildMailingCopy,
} = require('../../../packages/server/mailing/mailing.service.js');

describe('MailingSchema.methods.duplicate', () => {
  function makeDoc(overrides = {}) {
    return {
      _id: mongoose.Types.ObjectId('507f1f77bcf86cd799439001'),
      name: 'Campagne été ',
      espIds: [{ id: 'esp-1' }],
      subject: 'Soldes: -50%',
      _emailType: mongoose.Types.ObjectId('507f1f77bcf86cd799439101'),
      plannedSendDate: new Date('2026-07-01T08:00:00.000Z'),
      data: null,
      markModified: jest.fn(),
      ...overrides,
    };
  }

  it('clears the planned send date', () => {
    const doc = makeDoc();

    MailingSchema.methods.duplicate.call(doc, {});

    expect(doc.plannedSendDate).toBeUndefined();
  });

  it('keeps the subject and the typology', () => {
    const doc = makeDoc();
    const emailType = doc._emailType;

    MailingSchema.methods.duplicate.call(doc, {});

    expect(doc.subject).toBe('Soldes: -50%');
    expect(doc._emailType).toBe(emailType);
  });

  it('still does what it did before: new id, "copy" name, no esp ids', () => {
    const doc = makeDoc();
    const oldId = doc._id;

    MailingSchema.methods.duplicate.call(doc, {});

    expect(String(doc._id)).not.toBe(String(oldId));
    expect(doc.name).toBe('Campagne été copy');
    expect(doc.espIds).toEqual([]);
    expect(doc.isNew).toBe(true);
  });
});

// `copyMailing` and `duplicateWithTranslatedData` both build their copy through
// the shared `buildMailingCopy`, so testing that function covers both sites by
// construction — no need to assert on their source.
describe('buildMailingCopy', () => {
  const source = {
    _id: 'source-id',
    id: 'source-id',
    name: 'Campagne été',
    _company: 'company-a',
    espIds: [{ id: 'esp-1' }],
    _workspace: 'workspace-a',
    workspace: 'workspace-a',
    _parentFolder: 'folder-a',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    subject: 'Soldes: -50%',
    _emailType: 'type-a',
    plannedSendDate: new Date('2026-07-01'),
  };

  it('drops the planned send date', () => {
    expect(buildMailingCopy(source)).not.toHaveProperty('plannedSendDate');
  });

  it('keeps the subject and the typology', () => {
    const copy = buildMailingCopy(source);
    expect(copy.subject).toBe('Soldes: -50%');
    expect(copy._emailType).toBe('type-a');
  });

  it('still drops identity, authorship, esp ids and the source location', () => {
    const copy = buildMailingCopy(source);
    [
      '_id',
      'id',
      'createdAt',
      'updatedAt',
      'espIds',
      '_workspace',
      'workspace',
      '_parentFolder',
    ].forEach((field) => {
      expect(copy).not.toHaveProperty(field);
    });
  });

  it('keeps the company, so the typology stays consistent with it', () => {
    expect(buildMailingCopy(source)._company).toBe('company-a');
  });

  it('does not mutate the source', () => {
    buildMailingCopy(source);
    expect(source.plannedSendDate).toEqual(new Date('2026-07-01'));
  });
});

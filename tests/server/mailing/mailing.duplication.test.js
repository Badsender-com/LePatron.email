'use strict';

// There are THREE ways to duplicate a mailing, each with its own mechanics:
//   1. MailingSchema.methods.duplicate  — mutates the document in place
//   2. mailingService.copyMailing       — omit() blacklist on a plain object
//   3. duplicateWithTranslatedData      — the same blacklist, separately
//
// The metadata rule is the same on all three: `subject` and `_emailType` describe
// the email and follow the copy, `plannedSendDate` belongs to one campaign and
// must not be inherited — a copy silently carrying yesterday's send date is a
// planning bug nobody would look for. None of the three had a test before, and
// only #1 is reachable without a live Mongoose model, so #2 and #3 are pinned
// through their blacklist, which is the whole of their metadata behaviour.

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const MailingSchema = require('../../../packages/server/mailing/mailing.schema.js');

const SERVICE_PATH = path.join(
  __dirname,
  '../../../packages/server/mailing/mailing.service.js'
);

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

// copyMailing and duplicateWithTranslatedData both need Workspaces/Folders and a
// live model to run. What matters for metadata is entirely in their omit()
// blacklist, so we read the source and assert on it — a future edit that drops
// `plannedSendDate` from either list fails here.
describe('copyMailing and duplicateWithTranslatedData blacklists', () => {
  const source = fs.readFileSync(SERVICE_PATH, 'utf8');

  // Only the quoted entries, so the explanatory comments inside the array do not
  // count as field names.
  const blacklists = source
    .split('const copy = omit(source, [')
    .slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf(']')))
    .map((chunk) => (chunk.match(/'[^']+'/g) || []).map((q) => q.slice(1, -1)));

  it('finds exactly the two known copy sites', () => {
    expect(blacklists).toHaveLength(2);
  });

  it.each([0, 1])('drops plannedSendDate on copy site #%i', (index) => {
    expect(blacklists[index]).toContain('plannedSendDate');
  });

  it.each([0, 1])('keeps subject and _emailType on copy site #%i', (index) => {
    expect(blacklists[index]).not.toContain('subject');
    expect(blacklists[index]).not.toContain('_emailType');
  });
});

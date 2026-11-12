'use strict';

// Every copy of a mailing — duplicate, copy, duplicate + translate — stores,
// for each block inserted from a saved block, the fields of
// shared/block-information.js only.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { findOne: jest.fn(), create: jest.fn() },
  Galleries: { findOne: jest.fn() },
  Workspaces: {},
  Folders: {},
  Groups: {},
  Templates: {},
  TaxonomyItems: {},
  Users: {},
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  getWorkspace: jest.fn(),
  doesUserHaveReadAccess: jest.fn(),
  doesUserHaveWriteAccess: jest.fn(),
}));
jest.mock('../../../packages/server/folder/folder.service.js', () => ({
  hasAccess: jest.fn(),
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  copyImages: jest.fn(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');
const {
  Mailings,
  Galleries,
} = require('../../../packages/server/common/models.common.js');
const workspaceService = require('../../../packages/server/workspace/workspace.service.js');
const MailingSchema = require('../../../packages/server/mailing/mailing.schema.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const {
  KEPT_INFORMATION,
  dataWithSavedBlocks,
  informationOf,
} = require('./block-information.fixtures.js');

const MAILING = '507f1f77bcf86cd799439041';
const user = {
  id: 'user-1',
  _id: 'user-1',
  name: 'Reader',
  group: { id: 'g' },
};

beforeEach(() => {
  jest.resetAllMocks();
  Mailings.create.mockImplementation(async (copy) => ({
    ...copy,
    _id: 'copy',
  }));
  Galleries.findOne.mockResolvedValue(null);
  workspaceService.getWorkspace.mockResolvedValue({ _id: 'w', group: 'g' });
});

describe('the copy of a mailing — the saved block of a block', () => {
  it('keeps the kept fields only, through the duplicate method', () => {
    const doc = {
      _id: mongoose.Types.ObjectId(MAILING),
      name: 'Newsletter',
      data: dataWithSavedBlocks(),
      markModified: jest.fn(),
    };

    MailingSchema.methods.duplicate.call(doc, {});

    expect(informationOf(doc.data)).toEqual([undefined, KEPT_INFORMATION]);
  });

  it('keeps the kept fields only, through buildMailingCopy', () => {
    const source = { name: 'Newsletter', data: dataWithSavedBlocks() };

    const copy = mailingService.buildMailingCopy(source);

    expect(informationOf(copy.data)).toEqual([undefined, KEPT_INFORMATION]);
    // The source is read, never changed.
    expect(source.data).toEqual(dataWithSavedBlocks());
  });

  it('keeps the kept fields only, in the translated content of the copy', async () => {
    const doc = { _id: MAILING, name: 'Newsletter', _workspace: 'w' };
    Mailings.findOne.mockResolvedValue({
      ...doc,
      toObject: () => ({ ...doc }),
    });

    await mailingService.duplicateWithTranslatedData({
      mailingId: MAILING,
      user,
      newName: 'Newsletter - EN',
      translatedData: dataWithSavedBlocks(),
    });

    const [[stored]] = Mailings.create.mock.calls;
    expect(informationOf(stored.data)).toEqual([undefined, KEPT_INFORMATION]);
  });
});

// The company dimension values of a translated copy (ADR-0023): those the job
// computed for the target language, and no empty list when none is left
// (mailing.schema.js).
describe('the translated copy of a mailing — its company dimension values', () => {
  const translate = async (taxonomyItemIds) => {
    const doc = {
      _id: MAILING,
      name: 'Newsletter',
      _workspace: 'w',
      _taxonomyItems: ['belgium', 'french'],
    };
    Mailings.findOne.mockResolvedValue({
      ...doc,
      toObject: () => ({ ...doc }),
    });

    await mailingService.duplicateWithTranslatedData({
      mailingId: MAILING,
      user,
      newName: 'Newsletter - EN',
      taxonomyItemIds,
    });

    const [[stored]] = Mailings.create.mock.calls;
    return stored;
  };

  it('carries the values computed for the target language', async () => {
    const stored = await translate(['belgium', 'english']);

    expect(stored._taxonomyItems).toEqual(['belgium', 'english']);
  });

  it('stores no empty list when no value is left', async () => {
    const stored = await translate([]);

    expect(stored._taxonomyItems).toBeUndefined();
  });

  it("keeps the source's values when the job computed none", async () => {
    const stored = await translate(undefined);

    expect(stored._taxonomyItems).toEqual(['belgium', 'french']);
  });
});

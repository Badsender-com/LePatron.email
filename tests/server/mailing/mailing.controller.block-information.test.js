'use strict';

// PUT /mailings/:mailingId/mosaico stores, for each block inserted from a
// saved block, the fields of shared/block-information.js only.

const {
  mockMailing,
  save,
  resetMocks,
} = require('./update-mosaico.harness.js');
const {
  KEPT_INFORMATION,
  dataWithSavedBlocks,
  informationOf,
} = require('./block-information.fixtures.js');

beforeEach(resetMocks);

describe('PUT /mailings/:mailingId/mosaico — the saved block of a block', () => {
  it('stores its id, name, category and author name only', async () => {
    const mailing = mockMailing({}, '');

    expect(await save({ data: dataWithSavedBlocks() })).toBeNull();

    expect(informationOf(mailing.data)).toEqual([undefined, KEPT_INFORMATION]);
    expect(mailing.markModified).toHaveBeenCalledWith('data');
    expect(mailing.save).toHaveBeenCalled();
  });

  it('keeps the rest of the content as sent', async () => {
    const mailing = mockMailing({}, '');

    await save({ data: dataWithSavedBlocks() });

    expect(mailing.data.mainBlocks.blocks.map(({ id }) => id)).toEqual([
      'ko_titleBlock_1',
      'ko_footerBlock_2',
    ]);
  });

  it('brings the stored content to the same fields when the request has none', async () => {
    const mailing = mockMailing(dataWithSavedBlocks(), '');

    expect(await save({ name: 'Newsletter' })).toBeNull();

    expect(informationOf(mailing.data)).toEqual([undefined, KEPT_INFORMATION]);
  });
});

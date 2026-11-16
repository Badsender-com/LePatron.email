'use strict';

// A mailing whose blocks were inserted from saved blocks, with a
// `blockInformation` holding more than the fields a block keeps
// (packages/shared/block-information.js), at both levels.

const KEPT_INFORMATION = Object.freeze({
  _id: '507f1f77bcf86cd799439011',
  name: 'Footer',
  category: 'Legal',
  userDetails: Object.freeze({ name: 'Camille' }),
});

const informationWithMore = () => ({
  ...KEPT_INFORMATION,
  createdAt: '2026-11-01T10:00:00.000Z',
  role: 'company_admin',
  userDetails: {
    name: 'Camille',
    email: 'camille@example.test',
    role: 'company_admin',
  },
});

const dataWithSavedBlocks = () => ({
  mainBlocks: {
    blocks: [
      { type: 'titleBlock', id: 'ko_titleBlock_1' },
      {
        type: 'footerBlock',
        id: 'ko_footerBlock_2',
        blockInformation: informationWithMore(),
      },
    ],
  },
});

/** The `blockInformation` of each block of a model, in order. */
const informationOf = (data) =>
  data.mainBlocks.blocks.map((block) => block.blockInformation);

module.exports = {
  KEPT_INFORMATION,
  informationWithMore,
  dataWithSavedBlocks,
  informationOf,
};

'use strict';

const {
  BLOCK_INFORMATION_FIELDS,
  AUTHOR_FIELDS,
  keepBlockInformation,
  needsKeeping,
  locateBlockInformationToKeep,
  keepBlockInformationFields,
} = require('../../packages/shared/block-information.js');

const KEPT = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Footer',
  category: 'Legal',
  userDetails: { name: 'Camille' },
};

// A block information carrying more than the kept fields, at both levels.
const withMore = () => ({
  ...KEPT,
  createdAt: '2026-11-01T10:00:00.000Z',
  _group: '507f1f77bcf86cd799439001',
  role: 'company_admin',
  userDetails: {
    name: 'Camille',
    email: 'camille@example.test',
    role: 'company_admin',
  },
});

const block = (blockInformation) => ({
  type: 'footerBlock',
  id: 'ko_footerBlock_3',
  ...(blockInformation === undefined ? {} : { blockInformation }),
});

describe('the fields a block keeps of the saved block it comes from', () => {
  it('are the id, the name, the category and the author name', () => {
    expect(BLOCK_INFORMATION_FIELDS).toEqual(['_id', 'name', 'category']);
    expect(AUTHOR_FIELDS).toEqual(['name']);
  });
});

describe('keepBlockInformation', () => {
  it('keeps the kept fields only, at both levels', () => {
    expect(keepBlockInformation(withMore())).toEqual(KEPT);
  });

  it('leaves the author out when there is none', () => {
    const { userDetails: _author, ...withoutAuthor } = KEPT;

    expect(keepBlockInformation(withoutAuthor)).toEqual(withoutAuthor);
  });

  it('keeps an author without a name as an empty author', () => {
    expect(
      keepBlockInformation({ ...KEPT, userDetails: { role: 'x' } }).userDetails
    ).toEqual({});
  });

  it('leaves out an author that is not an object', () => {
    expect(
      keepBlockInformation({ ...KEPT, userDetails: null })
    ).not.toHaveProperty('userDetails');
  });

  it('adds no field the input does not have', () => {
    expect(keepBlockInformation({ name: 'Footer', role: 'x' })).toEqual({
      name: 'Footer',
    });
  });
});

describe('needsKeeping', () => {
  it('is false for a block information made of the kept fields', () => {
    expect(needsKeeping(KEPT)).toBe(false);
    expect(needsKeeping({ name: 'Footer' })).toBe(false);
    expect(needsKeeping({ ...KEPT, userDetails: {} })).toBe(false);
  });

  it('is true for another field, at either level', () => {
    expect(needsKeeping({ ...KEPT, role: 'x' })).toBe(true);
    expect(
      needsKeeping({ ...KEPT, userDetails: { name: 'C', role: 'x' } })
    ).toBe(true);
  });

  it('is true for an author that is not an object', () => {
    expect(needsKeeping({ ...KEPT, userDetails: null })).toBe(true);
    expect(needsKeeping({ ...KEPT, userDetails: 'Camille' })).toBe(true);
  });

  it('is false for what is not an object', () => {
    [undefined, null, 'Footer', 3, ['x']].forEach((value) => {
      expect(needsKeeping(value)).toBe(false);
    });
  });
});

describe('keepBlockInformationFields', () => {
  const model = () => ({
    mainBlocks: {
      type: 'blocks',
      blocks: [block(), block(withMore()), block(KEPT)],
    },
    sideBlocks: { blocks: [block(withMore())] },
    titleText: 'Hello',
  });

  it('brings every block of every container to the kept fields', () => {
    const kept = keepBlockInformationFields(model());

    expect(kept.mainBlocks.blocks[1].blockInformation).toEqual(KEPT);
    expect(kept.sideBlocks.blocks[0].blockInformation).toEqual(KEPT);
  });

  it('keeps everything else of the model and of the blocks', () => {
    const kept = keepBlockInformationFields(model());

    expect(kept.titleText).toBe('Hello');
    expect(kept.mainBlocks.type).toBe('blocks');
    expect(kept.mainBlocks.blocks[0]).toEqual(block());
    expect(kept.mainBlocks.blocks[1].id).toBe('ko_footerBlock_3');
    expect(kept.mainBlocks.blocks[2]).toEqual(block(KEPT));
  });

  it('leaves its input as it is', () => {
    const data = model();

    keepBlockInformationFields(data);

    expect(data).toEqual(model());
  });

  it('returns the same model when nothing is to be dropped', () => {
    const data = { mainBlocks: { blocks: [block(KEPT), block()] } };

    expect(keepBlockInformationFields(data)).toBe(data);
  });

  it('accepts a model that is not one', () => {
    [undefined, null, 'x', { mainBlocks: { blocks: 'x' } }].forEach((data) => {
      expect(keepBlockInformationFields(data)).toBe(data);
    });
  });
});

describe('locateBlockInformationToKeep', () => {
  it('names the container and the position of each block to bring back', () => {
    const data = {
      mainBlocks: { blocks: [block(), block(withMore()), block(KEPT)] },
      sideBlocks: { blocks: [block(withMore())] },
    };

    expect(
      locateBlockInformationToKeep(data).map(({ container, index }) => ({
        container,
        index,
      }))
    ).toEqual([
      { container: 'mainBlocks', index: 1 },
      { container: 'sideBlocks', index: 0 },
    ]);
  });
});

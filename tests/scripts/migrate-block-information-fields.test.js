'use strict';

const {
  selectionQuery,
  planMailingUpdate,
  KEPT_FIELDS,
} = require('../../scripts/migrate-block-information-fields');
const {
  BLOCK_INFORMATION_FIELDS,
  AUTHOR_FIELDS,
} = require('../../packages/shared/block-information.js');
const {
  KEPT_INFORMATION,
  informationWithMore,
} = require('../server/mailing/block-information.fixtures.js');

const ID = '507f1f77bcf86cd799439041';
const PATH = 'data.mainBlocks.blocks.1.blockInformation';

const mailing = (data) => ({ _id: ID, data });
const block = (blockInformation) => ({ type: 'footerBlock', blockInformation });

// Every node of an aggregation expression, with the expressions known to be
// of a type at that point (`$cond` on `$type`).
function walk(node, visit, known = {}) {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit, known));
    return;
  }
  if (!node || typeof node !== 'object') return;
  visit(node, known);
  if (node.$cond) {
    const [condition, then, otherwise] = node.$cond;
    const typed = condition.$eq && condition.$eq[0] && condition.$eq[0].$type;
    const isArray = condition.$isArray && condition.$isArray[0];
    const thenKnown = { ...known };
    if (typed && condition.$eq[1] === 'object') thenKnown[typed] = 'object';
    if (isArray) thenKnown[isArray] = 'array';
    walk(condition, visit, known);
    walk(then, visit, thenKnown);
    walk(otherwise, visit, known);
    return;
  }
  Object.values(node).forEach((child) => walk(child, visit, known));
}

describe('migrate-block-information-fields :: selectionQuery', () => {
  const query = selectionQuery();

  it('keeps the fields of the shared list, at both levels', () => {
    const lists = [];
    walk(query, (node) => {
      if (node.$setDifference) lists.push(node.$setDifference[1]);
    });

    expect(KEPT_FIELDS).toEqual([...BLOCK_INFORMATION_FIELDS, 'userDetails']);
    expect(lists).toEqual([KEPT_FIELDS, AUTHOR_FIELDS]);
  });

  it('reads every container of the content, not only mainBlocks', () => {
    expect(JSON.stringify(query)).toContain('{"$objectToArray":"$data"}');
    expect(JSON.stringify(query)).not.toContain('mainBlocks');
  });

  // An error on one email would stop the whole run.
  it('turns only objects into arrays, and maps only arrays', () => {
    const unguarded = [];
    walk(query, (node, known) => {
      if (node.$objectToArray && known[node.$objectToArray] !== 'object') {
        unguarded.push(node.$objectToArray);
      }
      const input = node.$map && node.$map.input;
      if (typeof input === 'string' && known[input] !== 'array') {
        unguarded.push(input);
      }
    });

    expect(unguarded).toEqual([]);
  });
});

describe('migrate-block-information-fields :: planMailingUpdate', () => {
  it('plans nothing for an email whose blocks keep the kept fields', () => {
    expect(
      planMailingUpdate(
        mailing({ mainBlocks: { blocks: [block(KEPT_INFORMATION), {}] } })
      )
    ).toBeNull();
    expect(planMailingUpdate(mailing(undefined))).toBeNull();
  });

  it('sets the kept fields of each block concerned', () => {
    const plan = planMailingUpdate(
      mailing({ mainBlocks: { blocks: [{}, block(informationWithMore())] } })
    );

    expect(plan.blockCount).toBe(1);
    expect(plan.write.updateOne.update).toEqual({
      $set: { [PATH]: KEPT_INFORMATION },
    });
  });

  // A block moved or changed between the read and the write is left as it is.
  it('writes only where each block still holds what was read', () => {
    const plan = planMailingUpdate(
      mailing({ mainBlocks: { blocks: [{}, block(informationWithMore())] } })
    );

    expect(plan.write.updateOne.filter).toEqual({
      _id: ID,
      [PATH]: informationWithMore(),
    });
  });

  it('covers every container, at each position', () => {
    const plan = planMailingUpdate(
      mailing({
        mainBlocks: { blocks: [block(informationWithMore())] },
        sideBlocks: { blocks: [{}, {}, block(informationWithMore())] },
      })
    );

    expect(plan.blockCount).toBe(2);
    expect(Object.keys(plan.write.updateOne.update.$set)).toEqual([
      'data.mainBlocks.blocks.0.blockInformation',
      'data.sideBlocks.blocks.2.blockInformation',
    ]);
  });

  it('leaves a container whose name cannot be a path, and counts it', () => {
    const plan = planMailingUpdate(
      mailing({
        'odd.name': { blocks: [block(informationWithMore())] },
        mainBlocks: { blocks: [block(informationWithMore())] },
      })
    );

    expect(plan.blockCount).toBe(1);
    expect(plan.skippedCount).toBe(1);
    expect(Object.keys(plan.write.updateOne.update.$set)).toEqual([
      'data.mainBlocks.blocks.0.blockInformation',
    ]);
    expect(
      planMailingUpdate(
        mailing({ $odd: { blocks: [block(informationWithMore())] } })
      )
    ).toEqual({ blockCount: 0, skippedCount: 1, write: null });
  });
});

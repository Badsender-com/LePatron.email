#!/usr/bin/env node
'use strict';

/**
 * Migration: the `blockInformation` of each block of an email keeps the
 * fields of packages/shared/block-information.js — the saved block's id,
 * name and category, and its author's name — and nothing else.
 *
 * The server keeps only these fields whenever it writes an email's content;
 * this brings the emails stored before to the same shape. Only the
 * `blockInformation` of the blocks concerned is rewritten, each one guarded by
 * the value it held when read: a block moved or changed since is left as it
 * is, and the next run picks it up. Re-running the script matches nothing.
 *
 * Writes go through the driver, not through Mongoose: the schema's timestamps
 * do not apply, and an email's `updatedAt` (its "last modified") stays as it
 * was.
 *
 * Prints counts and email ids only, never a value it drops.
 *
 * Usage:
 *   node scripts/migrate-block-information-fields.js              # apply
 *   node scripts/migrate-block-information-fields.js --dry-run    # report
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();
const config = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'node.config.js'
));
const { Mailings } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));
const {
  BLOCK_INFORMATION_FIELDS,
  AUTHOR_FIELD,
  AUTHOR_FIELDS,
  keepBlockInformation,
  locateBlockInformationToKeep,
} = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'shared',
  'block-information.js'
));

const DRY = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;
const KEPT_FIELDS = Object.freeze([...BLOCK_INFORMATION_FIELDS, AUTHOR_FIELD]);
// A container name goes into an update path: one that is not a plain
// identifier is reported, never written.
const WRITABLE_CONTAINER = /^[A-Za-z0-9_-]+$/;

const typeIs = (expression, type) => ({ $eq: [{ $type: expression }, type] });

const hasKeysOutside = (objectExpression, fields) => ({
  $gt: [
    {
      $size: {
        $setDifference: [
          {
            $map: {
              input: { $objectToArray: objectExpression },
              as: 'field',
              in: '$$field.k',
            },
          },
          fields,
        ],
      },
    },
    0,
  ],
});

/**
 * The filter of the emails holding a block whose `blockInformation` has a
 * field other than the kept ones, at either level. The same rule as
 * `needsKeeping` (shared/block-information.js), in the aggregation language;
 * every `$objectToArray` sits behind a type check, so a value of any shape
 * is read without error.
 *
 * @returns {Object} a find filter
 */
function selectionQuery() {
  const information = '$$block.blockInformation';
  const author = `${information}.${AUTHOR_FIELD}`;
  const blockToKeep = {
    $cond: [
      typeIs(information, 'object'),
      {
        $or: [
          hasKeysOutside(information, KEPT_FIELDS),
          {
            $cond: [
              typeIs(author, 'missing'),
              false,
              {
                $cond: [
                  typeIs(author, 'object'),
                  hasKeysOutside(author, AUTHOR_FIELDS),
                  true,
                ],
              },
            ],
          },
        ],
      },
      false,
    ],
  };
  const containerToKeep = {
    $cond: [
      { $isArray: ['$$container.v.blocks'] },
      {
        $anyElementTrue: [
          {
            $map: {
              input: '$$container.v.blocks',
              as: 'block',
              in: blockToKeep,
            },
          },
        ],
      },
      false,
    ],
  };
  return {
    $expr: {
      $anyElementTrue: [
        {
          $map: {
            input: {
              $cond: [
                typeIs('$data', 'object'),
                { $objectToArray: '$data' },
                [],
              ],
            },
            as: 'container',
            in: containerToKeep,
          },
        },
      ],
    },
  };
}

/**
 * The write that brings one email's blocks to the kept fields, or null when
 * there is nothing to do.
 *
 * @param {Object} mailing a raw document, with `_id` and `data`
 * @returns {{ blockCount: number, skippedCount: number, write: Object }|null}
 */
function planMailingUpdate(mailing) {
  const found = locateBlockInformationToKeep(mailing.data);
  const writable = found.filter(({ container }) =>
    WRITABLE_CONTAINER.test(container)
  );
  if (!writable.length) {
    return found.length
      ? { blockCount: 0, skippedCount: found.length, write: null }
      : null;
  }
  const filter = { _id: mailing._id };
  const $set = {};
  writable.forEach(({ container, index, information }) => {
    const field = `data.${container}.blocks.${index}.blockInformation`;
    filter[field] = information;
    $set[field] = keepBlockInformation(information);
  });
  return {
    blockCount: writable.length,
    skippedCount: found.length - writable.length,
    write: { updateOne: { filter, update: { $set } } },
  };
}

async function flush(collection, writes) {
  if (!writes.length) return 0;
  const result = await collection.bulkWrite(writes, { ordered: false });
  return result.modifiedCount || result.nModified || 0;
}

async function main() {
  console.log(`Block information fields (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log(`Connected to database ${mongoose.connection.name}`);
  try {
    const collection = Mailings.collection;
    const cursor = collection
      .find(selectionQuery(), { projection: { data: 1 } })
      .batchSize(BATCH_SIZE);

    const ids = [];
    let blocks = 0;
    let skipped = 0;
    let rewritten = 0;
    let writes = [];
    while (await cursor.hasNext()) {
      const mailing = await cursor.next();
      const plan = planMailingUpdate(mailing);
      if (!plan) continue;
      skipped += plan.skippedCount;
      if (!plan.write) continue;
      ids.push(String(mailing._id));
      blocks += plan.blockCount;
      if (DRY) continue;
      writes.push(plan.write);
      if (writes.length >= BATCH_SIZE) {
        rewritten += await flush(collection, writes);
        writes = [];
      }
    }
    rewritten += await flush(collection, writes);

    ids.forEach((id) => console.log(`  - ${id}`));
    console.log(
      `${ids.length} email(s), ${blocks} block(s) ${
        DRY ? 'to rewrite' : 'found'
      }${skipped ? `, ${skipped} block(s) in a container left as is` : ''}.`
    );
    if (!DRY) {
      console.log(
        `${rewritten} email(s) rewritten, ${
          ids.length - rewritten
        } changed since read and left for the next run.`
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    // The message only: a failed write carries its operation, which holds
    // the values the run drops.
    console.error(`${err.name}: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { selectionQuery, planMailingUpdate, KEPT_FIELDS };

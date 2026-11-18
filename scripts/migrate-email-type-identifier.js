#!/usr/bin/env node
'use strict';

/**
 * Migration: the doctrine type of an email type moves to a field of its own
 * (ADR-0030).
 *
 * The email types in production held their doctrine type in the field every
 * other value uses for its identifier. This copies it into `doctrineType`, or
 * `null` when the old value is none of the doctrine's six types. A value whose
 * `doctrineType` is already set, `null` included, is left alone: an admin may
 * have unmapped it since.
 *
 * It also reports any company dimension already named `doctrineType`, a name
 * the application now publishes to every template: renaming a dimension is the
 * company's call, never a script's.
 *
 * Idempotent: re-running is a no-op.
 *
 * Usage:
 *   node scripts/migrate-email-type-identifier.js              # apply
 *   node scripts/migrate-email-type-identifier.js --dry-run    # report only
 */

const path = require('path');

const serverPath = (...parts) =>
  path.resolve(__dirname, '..', 'packages', 'server', ...parts);
const { EmailTypeCanonicalValues } = require(serverPath(
  'constant',
  'email-type-canonical.js'
));

const DRY = process.argv.includes('--dry-run');
const RESERVED_NAME = 'doctrineType';

/**
 * Pure planning step, unit-testable without a database.
 *
 * @param {Object} params
 * @param {Object[]} params.emailTypes every email type value, all companies
 * @param {Object[]} [params.dimensions] every company dimension
 * @returns {{updates: Array<{id: *, company: *, set: Object}>,
 *   reservedNameTaken: Array<*>}}
 */
function planEmailTypeMigration({ emailTypes = [], dimensions = [] }) {
  const updates = [];
  emailTypes.forEach((item) => {
    const set = {};
    if (item.doctrineType === undefined) {
      set.doctrineType = EmailTypeCanonicalValues.includes(item.canonicalType)
        ? item.canonicalType
        : null;
    }
    if (Object.keys(set).length > 0) {
      updates.push({ id: item._id, company: item._company, set });
    }
  });

  const reservedNameTaken = dimensions
    .filter((dimension) => dimension.name === RESERVED_NAME)
    .map((dimension) => dimension._company);

  return { updates, reservedNameTaken };
}

async function main() {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const config = require(serverPath('node.config.js'));
  const { TaxonomyItems, TaxonomyDimensions } = require(serverPath(
    'common',
    'models.common.js'
  ));

  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    const emailTypes = await TaxonomyItems.find({ type: 'emailType' })
      .select({ _company: 1, label: 1, canonicalType: 1, doctrineType: 1 })
      .lean();
    const dimensions = await TaxonomyDimensions.find({ name: RESERVED_NAME })
      .select({ _company: 1, name: 1 })
      .lean();
    const { updates, reservedNameTaken } = planEmailTypeMigration({
      emailTypes,
      dimensions,
    });

    for (const update of updates) {
      const what = JSON.stringify(update.set);
      if (DRY) {
        console.log(`[dry] company ${update.company}: ${update.id} ← ${what}`);
      } else {
        await TaxonomyItems.updateOne({ _id: update.id }, { $set: update.set });
        console.log(`company ${update.company}: ${update.id} ← ${what}`);
      }
    }
    reservedNameTaken.forEach((company) =>
      console.warn(
        `[warn] company ${company} has a dimension named "${RESERVED_NAME}", ` +
          'which hides what the application publishes under that name. ' +
          'Rename it by hand.'
      )
    );
    console.log(
      `Email type migration: ${updates.length} value(s) updated${
        DRY ? ' (dry)' : ''
      } out of ${emailTypes.length}.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { planEmailTypeMigration };

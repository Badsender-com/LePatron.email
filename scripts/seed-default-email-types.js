#!/usr/bin/env node
'use strict';

/**
 * Seeds the six Badsender email types into companies that have none.
 *
 * New companies get them at creation (group.controller:create). This script is for
 * the ones that already exist — and for repairing a creation whose seed failed,
 * since that failure is deliberately non-fatal.
 *
 * A company holding even ONE email type is left alone: it has started its own
 * vocabulary, and topping up a list an admin curated would resurrect items they
 * deleted on purpose.
 *
 * Language: the taxonomy stores one label per item, so the seed has to pick. The
 * script uses `--lang`, defaulting to `en` like `User.lang` does. Labels are
 * ordinary editable strings — an admin renames them.
 *
 * Idempotent — re-running is a no-op.
 *
 * Usage:
 *   node scripts/seed-default-email-types.js               # apply, in English
 *   node scripts/seed-default-email-types.js --lang=fr     # apply, in French
 *   node scripts/seed-default-email-types.js --dry-run     # report only
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
const { Groups, TaxonomyItems } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));
const { TaxonomyTypes } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'constant',
  'taxonomy-type.js'
));
const taxonomyService = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'taxonomy',
  'taxonomy.service.js'
));

const DRY = process.argv.includes('--dry-run');
const LANG_ARG = process.argv.find((arg) => arg.startsWith('--lang='));
const LANG = LANG_ARG ? LANG_ARG.split('=')[1] : 'en';

/**
 * Pure planning step (unit-testable without a DB).
 *
 * @param {Array<{_id, name}>} companies every company
 * @param {Array<{_company}>} existingEmailTypes one entry per existing email-type
 *   item, of any company — only `_company` is read
 * @returns {{ toSeed: Array<{id: string, name: string}>, alreadySeeded: number }}
 */
function planEmailTypeSeeding(companies, existingEmailTypes) {
  const seeded = new Set(
    (existingEmailTypes || [])
      .map((item) => item && item._company)
      .filter(Boolean)
      .map(String)
  );

  const toSeed = [];
  let alreadySeeded = 0;

  for (const company of companies || []) {
    if (seeded.has(String(company._id))) alreadySeeded += 1;
    else toSeed.push({ id: String(company._id), name: company.name });
  }

  return { toSeed, alreadySeeded };
}

async function main() {
  console.log(
    `Connecting to ${config.database} (dry-run=${DRY}, lang=${LANG})…`
  );
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    const [companies, existingEmailTypes] = await Promise.all([
      Groups.find({}, { name: 1 }).lean(),
      TaxonomyItems.find(
        { type: TaxonomyTypes.EMAIL_TYPE },
        { _company: 1 }
      ).lean(),
    ]);

    const { toSeed, alreadySeeded } = planEmailTypeSeeding(
      companies,
      existingEmailTypes
    );

    for (const company of toSeed) {
      if (DRY) {
        console.log(
          `[dry] would seed 6 email types on "${company.name}" (${company.id})`
        );
      } else {
        const created = await taxonomyService.seedDefaultEmailTypes({
          companyId: company.id,
          lang: LANG,
        });
        console.log(
          `seeded ${created.length} email types on "${company.name}" (${company.id})`
        );
      }
    }

    console.log(
      `Default email types: ${toSeed.length} company(ies) seeded${
        DRY ? ' (dry)' : ''
      }, ${alreadySeeded} already had their own.`
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

module.exports = { planEmailTypeSeeding };

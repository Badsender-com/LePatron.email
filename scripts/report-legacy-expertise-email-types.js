#!/usr/bin/env node
'use strict';

/**
 * Report: the expertises still tagged with the retired email-type vocabulary.
 *
 * The move to the six Badsender types was deliberately NOT migrated, because two of
 * the three retired values have no single successor: a `newsletter` is editorial
 * or promotional depending on what its main block does, and `marketing-automation`
 * is a trigger, not a type. Only someone reading the expertise can tell.
 *
 * What makes that choice risky is that the failure is silent: an expertise whose
 * `appliesToEmailTypes` holds only retired values stops loading, with nothing
 * logged. This script turns the manual check of the release (recette §D6) into a
 * list — run it before going to production, retag what it prints, run it again
 * until it prints nothing.
 *
 * Read-only. Exits with code 1 when something is left to retag, so it can gate a
 * release checklist.
 *
 * Usage:
 *   node scripts/report-legacy-expertise-email-types.js
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
const { Expertises } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));

// Retired value → what to retag it with. A hint for whoever retags, not a rule the
// script applies: the two ambiguous ones say so.
const RETIRED_EMAIL_TYPES = Object.freeze({
  promo: 'promotional',
  newsletter: 'editorial or promotional, depending on what the main block does',
  'marketing-automation':
    'a type from what the email brings; the automation is the trigger now',
});

/**
 * Pure step (unit-testable without a DB).
 *
 * @param {Array<{expertiseId: string, title: string, appliesToEmailTypes: string[]}>} expertises
 * @returns {Array<{expertiseId: string, title: string, retired: string[]}>}
 *   the expertises carrying at least one retired value, and which ones
 */
function findLegacyTaggedExpertises(expertises) {
  return (expertises || [])
    .map((expertise) => ({
      expertiseId: expertise.expertiseId,
      title: expertise.title,
      retired: (expertise.appliesToEmailTypes || []).filter((value) =>
        Object.prototype.hasOwnProperty.call(RETIRED_EMAIL_TYPES, value)
      ),
    }))
    .filter((expertise) => expertise.retired.length > 0);
}

async function main() {
  console.log(`Connecting to ${config.database}…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    const expertises = await Expertises.find(
      { appliesToEmailTypes: { $in: Object.keys(RETIRED_EMAIL_TYPES) } },
      { expertiseId: 1, title: 1, appliesToEmailTypes: 1 }
    ).lean();

    const legacy = findLegacyTaggedExpertises(expertises);

    for (const expertise of legacy) {
      console.log(`"${expertise.title}" (${expertise.expertiseId})`);
      for (const value of expertise.retired) {
        console.log(`  ${value} → ${RETIRED_EMAIL_TYPES[value]}`);
      }
    }

    console.log(
      legacy.length
        ? `${legacy.length} expertise(s) to retag before going to production.`
        : 'No expertise tagged with the retired vocabulary.'
    );
    if (legacy.length) process.exitCode = 1;
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

module.exports = { findLegacyTaggedExpertises, RETIRED_EMAIL_TYPES };

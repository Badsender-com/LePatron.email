#!/usr/bin/env node
'use strict';

/**
 * Take back the past openings and withdrawals of the skills and expertises
 * from the MCP call log (ADR 0031), for the catalog changes to date them.
 *
 * Dry by default: it lists what it found, and the ids the log names that name
 * no single item. Read the list, then run it again with --write.
 *
 * Usage:
 *   yarn take-back-audience-history            # dry run
 *   yarn take-back-audience-history --write
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();
const { databaseHost } = require('./database-host');
const config = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'node.config.js'
));
const { takeBackAudienceHistory } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'ai-skill',
  'services',
  'audience-history-take-back.js'
));

async function main() {
  const write = process.argv.includes('--write');
  console.log(`Connecting to ${databaseHost(config.database)}…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    const { found, unresolved, written } = await takeBackAudienceHistory({
      write,
    });
    found.forEach((c) =>
      console.log(`${c.at}  ${c.kind} ${c.id} → ${c.audience}`)
    );
    if (unresolved.length) {
      console.log(`\nNo single item for: ${unresolved.join(', ')}`);
    }
    console.log(
      write
        ? `\n✓ ${written} change(s) written`
        : `\n${found.length} change(s) found, nothing written: run again with --write`
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});

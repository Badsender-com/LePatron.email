'use strict';

/**
 * The runner shared by the gallery maintenance scripts.
 *
 * A script says which galleries still need work (`query`) and what to do with
 * one of them (`processGallery`); the runner owns everything else, the same
 * way for both: connection, paging, bounded concurrency, the summary and the
 * exit code.
 *
 * Paging by `_id` rather than a server cursor: a cursor left without a
 * `getMore` for ten minutes is killed by the server, and a script that probes
 * a slow storage between two batches gets there. A page is a fresh query, so
 * nothing on the server can expire under it. Reading only the galleries that
 * still need work is also what makes a rerun, or a resume after a crash, cost
 * one query when everything is done.
 */

const mongoose = require('mongoose');

const config = require('../../packages/server/node.config.js');
const modelNames = require('../../packages/server/constant/model.names.js');
const GallerySchema = require('../../packages/server/image/gallery.schema.js');
const {
  parseArgs,
  confirmDatabase,
  databaseHosts,
  redact,
  listenForStop,
} = require('./command-line.js');

// The gallery model alone, not models.common.js: loading every model of the
// application also loads the mail service, which opens an SMTP connection to
// check it, and registers indexes this script has no business building.
const Galleries =
  mongoose.models[modelNames.GalleryModel] ||
  mongoose.model(modelNames.GalleryModel, GallerySchema);

const PAGE_SIZE = 100;
const EXIT_FAILURE = 1;
const SUMMARY_LABEL_WIDTH = 21;

function addCounts(totals, counts) {
  for (const [key, value] of Object.entries(counts || {})) {
    totals[key] = (totals[key] || 0) + value;
  }
}

async function* pages(collection, query, projection) {
  let lastId = null;
  for (;;) {
    const filter = lastId ? { $and: [query, { _id: { $gt: lastId } }] } : query;
    // eslint-disable-next-line no-await-in-loop
    const page = await collection
      .find(filter, { projection })
      .sort({ _id: 1 })
      .limit(PAGE_SIZE)
      .toArray();
    if (page.length === 0) return;
    lastId = page[page.length - 1]._id;
    yield page;
  }
}

// `worker` never throws: each gallery's failure is its own.
async function eachWithConcurrency(items, concurrency, worker, isStopping) {
  let next = 0;
  const lane = async () => {
    while (next < items.length && !isStopping()) {
      const item = items[next];
      next += 1;
      // eslint-disable-next-line no-await-in-loop
      await worker(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, lane)
  );
}

function printHeader(script, dryRun) {
  console.log(script.title);
  if (dryRun) console.log('[DRY-RUN] Nothing is written.');
  console.log(`Connecting to ${databaseHosts(config.database)}…`);
}

// The name is not a secret, and it is what tells a copy from production when
// both live on the same hosts.
function printTarget(script, databaseName) {
  console.log(
    `Database: "${databaseName}" on ${databaseHosts(config.database)}`
  );
  const environment = script.describeEnvironment
    ? script.describeEnvironment()
    : [];
  for (const line of environment) console.log(line);
}

async function processAll(script, { dryRun, concurrency, run, signal }) {
  const { collection } = Galleries;
  if (script.preflight) {
    addCounts(run.totals, await script.preflight({ collection, dryRun }));
  }
  run.toProcess = await collection.countDocuments(script.query);
  console.log(
    `Galleries to process: ${run.toProcess} (concurrency ${concurrency})\n`
  );

  const isStopping = () => signal.stopping;
  // what every gallery of the run shares: a script keeps its own counters in
  // `state`, and stops the run with `stop(reason)`
  const shared = { isStopping, stop: signal.stopFor, state: {} };
  const processOne = async (gallery) => {
    run.processed += 1;
    const id = String(gallery.creationOrWireframeId);
    const prefix = `[${run.processed}/${run.toProcess}] ${id}`;
    const log = (message) => console.log(`${prefix} ${message}`);
    try {
      const counts = await script.processGallery(gallery, {
        ...shared,
        dryRun,
        collection,
        log,
      });
      addCounts(run.totals, counts);
      log(script.describeCounts(counts, { dryRun }));
    } catch (error) {
      run.failedGalleries.push(id);
      console.error(`${prefix} ERROR ${redact(error.message)}`);
    }
  };

  for await (const page of pages(collection, script.query, script.projection)) {
    if (isStopping()) break;
    await eachWithConcurrency(page, concurrency, processOne, isStopping);
  }
}

/**
 * @param {object} script
 * @param {string} script.title
 * @param {object} script.query which galleries still need work
 * @param {object} script.projection
 * @param {Function} script.processGallery (gallery, context) => counts;
 *   context: dryRun, collection, log, isStopping, stop(reason), state
 * @param {Function} script.describeCounts (counts, { dryRun }) => one line
 * @param {Function} script.summarize (totals, { dryRun }) => [label, count]
 *   pairs
 * @param {Function} [script.describeEnvironment] () => lines
 * @param {Function} [script.preflight] ({ collection }) => counts; throws to
 *   stop before anything is processed
 * @param {Function} [script.assess] (totals, { dryRun }) => failure lines
 * @returns {Promise<number>} the exit code
 */
// Connected to the database the operator confirmed, or rejected with nothing
// done: a refusal is not a run to resume, it has no summary.
async function connect(script, database) {
  try {
    await mongoose.connect(config.database, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // a dry-run writes nothing, indexes included
      autoIndex: false,
    });
    printTarget(script, mongoose.connection.name);
    confirmDatabase(mongoose.connection.name, database);
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }
}

async function runGalleryScript(script, { argv = process.argv } = {}) {
  const { dryRun, concurrency, database } = parseArgs(argv);
  await config.setup;
  printHeader(script, dryRun);
  await connect(script, database);

  const signal = listenForStop();
  const run = { totals: {}, failedGalleries: [], processed: 0, toProcess: 0 };
  try {
    await processAll(script, { dryRun, concurrency, run, signal });
  } catch (error) {
    run.fatal = error;
  } finally {
    signal.release();
    await mongoose.disconnect();
  }
  return report({
    ...run,
    script,
    dryRun,
    stopping: signal.stopping,
    stopReason: signal.reason,
  });
}

// The entry point of both scripts: what fails before the run starts (the
// options, the configuration) is printed redacted too, and fails the process.
function runFromCommandLine(script, options) {
  return runGalleryScript(script, options).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`Fatal error: ${redact(error.message)}`);
      process.exitCode = EXIT_FAILURE;
    }
  );
}

function report(run) {
  const { script, dryRun, totals, failedGalleries } = run;
  console.log('\n--- Result ---');
  const rows = [
    ['Galleries processed', `${run.processed}/${run.toProcess}`],
    ...script.summarize(totals, { dryRun }),
  ];
  for (const [label, value] of rows) {
    console.log(`${label.padEnd(SUMMARY_LABEL_WIDTH)}: ${value || 0}`);
  }

  const failures = [];
  if (failedGalleries.length > 0) {
    failures.push(
      `${failedGalleries.length} gallery(ies) failed. Rerun once the cause ` +
        'is fixed: the galleries already done are not read again.',
      ...failedGalleries.map((id) => `  ${id}`)
    );
  }
  if (run.stopReason) {
    failures.push(
      `Stopped: ${run.stopReason}`,
      'Rerun once the cause is fixed: the run resumes where it stopped.'
    );
  } else if (run.stopping) {
    failures.push('Interrupted: rerun to resume.');
  }
  if (run.fatal) {
    failures.push(
      `Stopped by: ${redact(run.fatal.message)}`,
      'Rerun once the cause is fixed: the run resumes where it stopped.'
    );
  }
  if (script.assess) failures.push(...script.assess(totals, { dryRun }));

  if (dryRun) console.log('\n[DRY-RUN] Nothing was written.');
  if (failures.length === 0) return 0;
  console.error(`\nFAILED\n${failures.join('\n')}`);
  return EXIT_FAILURE;
}

module.exports = {
  runGalleryScript,
  runFromCommandLine,
  addCounts,
  eachWithConcurrency,
};

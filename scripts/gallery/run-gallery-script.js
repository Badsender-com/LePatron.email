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
const { Galleries } = require('../../packages/server/common/models.common.js');

const PAGE_SIZE = 100;
const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 32;
const EXIT_FAILURE = 1;

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const flag = argv.find((arg) => arg.startsWith('--concurrency='));
  if (!flag) return { dryRun, concurrency: DEFAULT_CONCURRENCY };
  const concurrency = Number(flag.slice('--concurrency='.length));
  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > MAX_CONCURRENCY
  ) {
    throw new Error(
      `--concurrency takes an integer from 1 to ${MAX_CONCURRENCY}`
    );
  }
  return { dryRun, concurrency };
}

// The hosts of a connection string, never its credentials: the URI carries the
// database password, and this output ends up in terminals and job logs.
// Parsed by hand because `new URL` rejects a replica set's host list.
function databaseHosts(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri || '');
  return match ? match[1] : 'an unparsable connection string';
}

// Driver errors can quote the connection string back.
function redact(message) {
  return String(message)
    .split(config.database)
    .join('<database URI>')
    .replace(/\/\/[^@/\s]+@/g, '//<credentials>@');
}

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
  console.log(`Database: ${databaseHosts(config.database)}`);
  const environment = script.describeEnvironment
    ? script.describeEnvironment()
    : [];
  for (const line of environment) console.log(line);
}

// Ctrl-C (or the platform stopping the job) lets the galleries in progress
// finish, then prints the summary: a resumable run should say where it stopped.
function listenForStop() {
  const signal = { stopping: false };
  const stop = () => {
    if (!signal.stopping) {
      console.log('\nStopping after the galleries in progress…');
    }
    signal.stopping = true;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  signal.release = () => {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  };
  return signal;
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

  const processOne = async (gallery) => {
    run.processed += 1;
    const id = String(gallery.creationOrWireframeId);
    const prefix = `[${run.processed}/${run.toProcess}] ${id}`;
    const log = (message) => console.log(`${prefix} ${message}`);
    try {
      const counts = await script.processGallery(gallery, {
        dryRun,
        collection,
        log,
      });
      addCounts(run.totals, counts);
      log(script.describeCounts(counts));
    } catch (error) {
      run.failedGalleries.push(id);
      console.error(`${prefix} ERROR ${redact(error.message)}`);
    }
  };

  const isStopping = () => signal.stopping;
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
 * @param {Function} script.processGallery (gallery, context) => counts
 * @param {Function} script.describeCounts counts => one line
 * @param {Function} script.summarize (totals, { dryRun }) => lines
 * @param {Function} [script.describeEnvironment] () => lines
 * @param {Function} [script.preflight] ({ collection }) => counts; throws to
 *   stop before anything is processed
 * @param {Function} [script.assess] (totals, { dryRun }) => failure lines
 * @returns {Promise<number>} the exit code
 */
async function runGalleryScript(script, { argv = process.argv } = {}) {
  const { dryRun, concurrency } = parseArgs(argv);
  await config.setup;
  printHeader(script, dryRun);

  const signal = listenForStop();
  const run = { totals: {}, failedGalleries: [], processed: 0, toProcess: 0 };
  try {
    await mongoose.connect(config.database, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await processAll(script, { dryRun, concurrency, run, signal });
  } catch (error) {
    run.fatal = error;
  } finally {
    signal.release();
    await mongoose.disconnect();
  }
  return report({ ...run, script, dryRun, stopping: signal.stopping });
}

function report(run) {
  const { script, dryRun, totals, failedGalleries } = run;
  console.log('\n--- Result ---');
  console.log(`Galleries processed : ${run.processed}/${run.toProcess}`);
  for (const line of script.summarize(totals, { dryRun })) console.log(line);

  const failures = [];
  if (failedGalleries.length > 0) {
    failures.push(
      `${failedGalleries.length} gallery(ies) failed. Rerun once the cause ` +
        'is fixed: the galleries already done are not read again.',
      ...failedGalleries.map((id) => `  ${id}`)
    );
  }
  if (run.stopping) failures.push('Interrupted: rerun to resume.');
  if (run.fatal) {
    failures.push(`Stopped by: ${redact(run.fatal.message)}. Rerun to resume.`);
  }
  if (script.assess) failures.push(...script.assess(totals, { dryRun }));

  if (dryRun) console.log('\n[DRY-RUN] Nothing was written.');
  if (failures.length === 0) return 0;
  console.error(`\nFAILED\n${failures.join('\n')}`);
  return EXIT_FAILURE;
}

module.exports = {
  runGalleryScript,
  parseArgs,
  databaseHosts,
  redact,
  addCounts,
  eachWithConcurrency,
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
};

'use strict';

const os = require('os');

/**
 * How many workers index.js forks, as it always computed it: WORKERS when it
 * does not exceed the CPUs, else one (see the warning there). Shared with
 * quality-resources.service.js, which logs the bounds that hold per worker.
 * @returns {number}
 */
function workerCount({
  workers = process.env.WORKERS,
  cpuCount = os.cpus().length,
} = {}) {
  return workers <= cpuCount ? Number(workers) : 1;
}

module.exports = { workerCount };

'use strict';

const os = require('os');

/**
 * How many workers index.js forks: WORKERS, unless it exceeds the CPUs (see
 * the warning there) or is not a number, then one. Read by the cluster and by
 * whoever reports bounds that hold per worker (quality-resources.service.js).
 * @returns {number}
 */
function workerCount({
  workers = process.env.WORKERS,
  cpuCount = os.cpus().length,
} = {}) {
  return workers <= cpuCount ? Number(workers) || 1 : 1;
}

module.exports = { workerCount };

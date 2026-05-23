'use strict';

const logger = require('../../utils/logger.js');
const {
  registerJob: registerPurgeJob,
} = require('./purge-skill-invocations.job.js');

/**
 * Thin wrapper around `agenda` so the scheduler can be replaced with a mock
 * in tests. Construction is lazy: agenda is only required when start() is
 * called, which keeps `require('./job-scheduler')` cheap and side-effect-free.
 */
class JobScheduler {
  constructor({ mongoUrl, agendaFactory } = {}) {
    this.mongoUrl = mongoUrl;
    this.agendaFactory = agendaFactory;
    this.agenda = null;
    this.registered = [];
  }

  async start() {
    if (this.agenda) return this.agenda;
    if (!this.mongoUrl) {
      logger.warn('[scheduler] no mongoUrl, skill jobs disabled');
      return null;
    }
    const Agenda = this.agendaFactory || require('agenda');
    this.agenda = new Agenda({
      db: { address: this.mongoUrl, collection: 'aiSkillJobs' },
      processEvery: '1 minute',
    });

    this.registered = [registerPurgeJob(this.agenda)];

    await this.agenda.start();
    for (const job of this.registered) {
      await this.agenda.every(job.schedule, job.name);
    }
    logger.log(
      `[scheduler] started with jobs: ${this.registered
        .map((j) => j.name)
        .join(', ')}`
    );
    return this.agenda;
  }

  async stop() {
    if (!this.agenda) return;
    await this.agenda.stop();
    this.agenda = null;
    logger.log('[scheduler] stopped');
  }
}

module.exports = JobScheduler;

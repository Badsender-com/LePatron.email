'use strict';

const EventEmitter = require('events');

class BadsenderBackendEmitter extends EventEmitter {}
const backendEmitter = new BadsenderBackendEmitter();
backendEmitter.setMaxListeners(0);

module.exports = backendEmitter;

'use strict';

/**
 * supertest, with its server listening where its requests go: 127.0.0.1.
 *
 * supertest listens on every address (`listen(0)`) and sends its request to
 * 127.0.0.1. macOS lets the system hand its server a port that another
 * process already holds on 127.0.0.1 alone (a test's fake server, the
 * editor, a container runtime), and the request then reaches that process:
 * a 401 or a 400 from nowhere, a reset connection, a timeout, once in twenty
 * runs. Listening on 127.0.0.1 itself makes the system pick a port that is
 * free there. Linux, where the CI runs, refuses the sharing, so the CI never
 * showed it.
 *
 * Listening on a given address is asynchronous, so the request waits for it.
 * Written against supertest 7 (`serverAddress`, `end`): a test file reads
 * supertest through this helper, never directly.
 */

const supertest = require('supertest');

const { Test } = supertest;
const end = Test.prototype.end;
const HOST = '127.0.0.1';

Test.prototype.serverAddress = function serverAddress(app, path) {
  this._localPath = path;
  // A server the test already started is used as it is, and left open.
  if (!app.address()) this._server = app.listen(0, HOST);
  return `http://${HOST}:0${path}`;
};

Test.prototype.end = function endOnceListening(fn) {
  const server = this._server || this.app;
  const send = () => {
    this.url = `http://${HOST}:${server.address().port}${this._localPath}`;
    end.call(this, fn);
  };
  if (server.address()) send();
  else server.once('listening', send);
  return this;
};

module.exports = supertest;

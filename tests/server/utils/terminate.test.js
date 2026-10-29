'use strict';

// The SIGTERM / SIGINT handler: closes the server, exits with the given code
// once it is closed, or after the timeout at the latest.

const terminate = require('../../../packages/server/utils/terminate.js');

describe('terminate', () => {
  let exit;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('exits with its code once the server is closed', () => {
    const server = { close: (callback) => callback() };

    terminate(server)(0, 'SIGTERM')();

    expect(exit).toHaveBeenCalledWith(0);
  });

  // close calls back with ERR_SERVER_NOT_RUNNING on a server that is not
  // listening; process.exit refuses an error since Node 20.
  it('exits with its code when the server was not listening', () => {
    const notRunning = new Error('Server is not running.');
    const server = { close: (callback) => callback(notRunning) };

    terminate(server)(0, 'SIGINT')();

    expect(exit).toHaveBeenCalledWith(0);
    expect(exit).not.toHaveBeenCalledWith(notRunning);
  });

  it('exits with its code after the timeout when the server does not close', () => {
    const server = { close: () => {} };

    terminate(server, { timeout: 500 })(0, 'SIGTERM')();
    expect(exit).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(exit).toHaveBeenCalledWith(0);
  });
});

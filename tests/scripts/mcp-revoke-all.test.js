'use strict';

// The script that cuts every assistant off (ADR 0012) does nothing unless
// told to: what it runs is tested in oauth.store.test.js.

const mongoose = require('mongoose');
const { main } = require('../../scripts/mcp-revoke-all.js');

describe('mcp-revoke-all', () => {
  it('changes nothing without --yes', async () => {
    const connect = jest.spyOn(mongoose, 'connect');
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    await expect(main(['node', 'mcp-revoke-all.js'])).resolves.toBeNull();

    expect(connect).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('--yes'));
    connect.mockRestore();
    log.mockRestore();
  });
});

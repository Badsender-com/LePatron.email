/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The MCP module (ADR 0017): a company's assistants read LePatron only while
// its module is open and its MCP access is on, checked on every call, with no
// way around it for a super admin.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

// Turned on by #1396 (a closed module refuses the assistants)
describe.skip('the MCP module', () => {
  beforeEach(() => {
    harness.seed(f.SEED);
    harness.update('groups', f.CLIENT_GROUP, {
      enableMcpModule: true,
      enableMcp: true,
    });
  });
  afterEach(() => harness.disconnect());

  it('lets a token through while the module is open and MCP access on', async () => {
    const client = await harness.connectAs(f.FRANK);

    await expect(client.listResources()).resolves.toBeDefined();
  });

  it('refuses the next call once the module is closed', async () => {
    const client = await harness.connectAs(f.FRANK);
    await client.listResources();

    harness.update('groups', f.CLIENT_GROUP, { enableMcpModule: false });

    await expect(client.listResources()).rejects.toThrow(/MCP module/i);
  });

  it("refuses a super admin's token too", async () => {
    const client = await harness.connectAs(f.ALICE, { group: f.CLIENT_GROUP });
    await client.listResources();

    harness.update('groups', f.CLIENT_GROUP, { enableMcpModule: false });

    await expect(client.listResources()).rejects.toThrow(/MCP module/i);
  });
});

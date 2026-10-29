/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Who may read through MCP (ADR 0012): every role of a group that has MCP
// access, with the rights the user has in the app, checked again on every call
// so a change takes effect without waiting for the token to expire.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const uris = ({ resources }) => resources.map((resource) => resource.uri);
const SUBJECT_LINES = 'lepatron://expertises/redaction.subject-line';

describe('identity and MCP access', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => harness.disconnect());

  it.each([
    ['company admin', f.ERIN],
    ['tech admin', f.TESS],
    ['regular user', f.FRANK],
    ['writer', f.WREN],
    ['reviewer', f.REX],
  ])('lets a %s of a subscribed group read', async (_role, userId) => {
    const client = await harness.connectAs(userId);

    expect(uris(await client.listResources())).toContain(SUBJECT_LINES);
  });

  it('lets a super admin read in the group picked at consent', async () => {
    const client = await harness.connectAs(f.ALICE, { group: f.CLIENT_GROUP });

    expect(uris(await client.listResources())).toContain(SUBJECT_LINES);
  });

  it('refuses a group without MCP access', async () => {
    const client = await harness.connectAs(f.NINA);

    await expect(client.listResources()).rejects.toThrow(/MCP access/i);
  });

  it('refuses the next call once MCP access is turned off', async () => {
    const client = await harness.connectAs(f.FRANK);
    await client.listResources();

    harness.update('groups', f.CLIENT_GROUP, { enableMcp: false });

    await expect(client.listResources()).rejects.toThrow(/MCP access/i);
  });

  it('refuses a deactivated account', async () => {
    const client = await harness.connectAs(f.DEAN);

    await expect(client.listResources()).rejects.toThrow();
  });

  it('refuses the next call once the account is deactivated', async () => {
    const client = await harness.connectAs(f.FRANK);
    await client.listResources();

    harness.update('users', f.FRANK, { isDeactivated: true });

    await expect(client.listResources()).rejects.toThrow();
  });

  it('refuses the next call once the user has left the group', async () => {
    const client = await harness.connectAs(f.FRANK);
    await client.listResources();

    harness.update('users', f.FRANK, { _company: f.OTHER_GROUP });

    await expect(client.listResources()).rejects.toThrow();
  });

  it('refuses a token bound to a group the user does not belong to', async () => {
    const client = await harness.connectAs(f.FRANK, { group: f.OTHER_GROUP });

    await expect(client.listResources()).rejects.toThrow();
  });

  // A super admin has rights on every group, so the group comes from the
  // token, never from a default: two clients' data never meet in one session.
  it('refuses a super admin token that names no group', async () => {
    const client = await harness.connectAs(f.ALICE, { group: null });

    await expect(client.listResources()).rejects.toThrow();
  });

  it('refuses a super admin token bound to a group without MCP access', async () => {
    const client = await harness.connectAs(f.ALICE, {
      group: f.UNSUBSCRIBED_GROUP,
    });

    await expect(client.listResources()).rejects.toThrow(/MCP access/i);
  });

  it('refuses a token the user did not consent to reading with', async () => {
    const client = await harness.connectAs(f.FRANK, { scopes: [] });

    await expect(client.listResources()).rejects.toThrow(/mcp:read/);
  });
});

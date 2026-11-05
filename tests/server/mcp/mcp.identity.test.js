/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Who may read through MCP (ADR 0012): every role of a company that has MCP
// access, with the rights the user has in the app, checked again on every call
// so a change takes effect without waiting for the token to expire. That every
// primitive the server registers checks it is in mcp.primitives.test.js.

const createError = require('http-errors');
const { ProtocolErrorCode } = require('@modelcontextprotocol/server');
const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');
// The stand-ins the harness put in place of the models, and of the logger.
const models = require('../../../packages/server/common/models.common.js');
const logger = require('../../../packages/server/utils/logger.js');
const {
  resolveIdentity,
} = require('../../../packages/server/mcp/mcp-identity.js');

const uris = ({ resources }) => resources.map((resource) => resource.uri);
const SUBJECT_LINES = 'lepatron://expertises/redaction.subject-line';
const NO_ACCOUNT = /can no longer use LePatron/;
const NO_COMPANY = /not bound to a company of this account/;
const NO_MCP_ACCESS = /no MCP access/;

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

  it('refuses a company without MCP access', async () => {
    const client = await harness.connectAs(f.NINA);

    await expect(client.listResources()).rejects.toThrow(NO_MCP_ACCESS);
  });

  it('refuses the next call once MCP access is turned off', async () => {
    const client = await harness.connectAs(f.FRANK);
    await client.listResources();

    harness.update('groups', f.CLIENT_GROUP, { enableMcp: false });

    await expect(client.listResources()).rejects.toThrow(NO_MCP_ACCESS);
  });

  it('refuses a deactivated account', async () => {
    const client = await harness.connectAs(f.DEAN);

    await expect(client.listResources()).rejects.toThrow(NO_ACCOUNT);
  });

  it('refuses the next call once the account is deactivated', async () => {
    const client = await harness.connectAs(f.FRANK);
    await client.listResources();

    harness.update('users', f.FRANK, { isDeactivated: true });

    await expect(client.listResources()).rejects.toThrow(NO_ACCOUNT);
  });

  it('refuses the next call once the user has left the company', async () => {
    const client = await harness.connectAs(f.FRANK);
    await client.listResources();

    harness.update('users', f.FRANK, { _company: f.OTHER_GROUP });

    await expect(client.listResources()).rejects.toThrow(NO_COMPANY);
  });

  it('refuses a token bound to a company the user does not belong to', async () => {
    const client = await harness.connectAs(f.FRANK, { group: f.OTHER_GROUP });

    await expect(client.listResources()).rejects.toThrow(NO_COMPANY);
  });

  // A super admin has rights on every company, so the company comes from the
  // token, never from a default: two clients' data never meet in one session.
  it('refuses a super admin token that names no company', async () => {
    const client = await harness.connectAs(f.ALICE, { group: null });

    await expect(client.listResources()).rejects.toThrow(NO_COMPANY);
  });

  it('refuses a super admin token bound to a company without MCP access', async () => {
    const client = await harness.connectAs(f.ALICE, {
      group: f.UNSUBSCRIBED_GROUP,
    });

    await expect(client.listResources()).rejects.toThrow(NO_MCP_ACCESS);
  });

  // An id in the token is a string the server wrote: an object there would be
  // a query operator, selecting whichever account matches it.
  it.each([
    ['account', { $ne: null }, f.CLIENT_GROUP, NO_ACCOUNT],
    ['company', f.FRANK, { $ne: null }, NO_COMPANY],
  ])(
    'refuses a token whose %s id is not an id, before any query',
    async (_what, userId, groupId, refusal) => {
      const findUser = jest.spyOn(models.Users, 'findOne');

      await expect(
        resolveIdentity({ scopes: ['mcp:read'], extra: { userId, groupId } })
      ).rejects.toThrow(refusal);
      expect(findUser).not.toHaveBeenCalled();
      findUser.mockRestore();
    }
  );

  it('builds the request user from the account, its company by id only', async () => {
    const { user } = await resolveIdentity({
      scopes: ['mcp:read'],
      extra: { userId: f.FRANK, groupId: f.CLIENT_GROUP },
    });

    expect(user).toMatchObject({
      id: f.FRANK,
      role: 'regular_user',
      group: { id: f.CLIENT_GROUP },
    });
    expect(user.capabilities).toEqual(expect.any(Array));
    expect(user).not.toHaveProperty('selectedGroup');
    expect(user).not.toHaveProperty('password');
  });

  it('gives a super admin the company the token is bound to as its selected one', async () => {
    const { user } = await resolveIdentity({
      scopes: ['mcp:read'],
      extra: { userId: f.ALICE, groupId: f.CLIENT_GROUP },
    });

    expect(user.selectedGroup).toEqual({ id: f.CLIENT_GROUP });
  });

  it('reads of the company what the handlers use, never its secrets', async () => {
    const { group } = await resolveIdentity({
      scopes: ['mcp:read'],
      extra: { userId: f.FRANK, groupId: f.CLIENT_GROUP },
    });

    expect(group).toEqual({ _id: f.CLIENT_GROUP, enableMcp: true });
  });

  // What fails in the server is logged; the assistant is told nothing of it.
  it('answers a failure it did not expect with a message that says nothing of the server', async () => {
    const failure = new Error('lost the connection to db.internal:27017');
    const read = jest
      .spyOn(models.Expertises, 'aggregate')
      .mockRejectedValue(failure);
    const client = await harness.connectAs(f.FRANK);

    const refusal = client.listResources();

    await expect(refusal).rejects.toThrow(/could not answer this request/);
    await expect(refusal).rejects.not.toThrow(/db\.internal/);
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), failure);
    read.mockRestore();
  });

  it('tells a tool the same, in its result', async () => {
    const read = jest
      .spyOn(models.Expertises, 'distinct')
      .mockRejectedValue(new Error('lost the connection to db.internal'));
    const client = await harness.connectAs(f.FRANK);

    const { error } = harness.answerOf(
      await client.callTool({
        name: 'find_applicable_expertises',
        arguments: { scope: 'subject', categories: ['redaction'] },
      })
    );

    expect(error).toMatch(/could not answer this request/);
    expect(error).not.toMatch(/db\.internal/);
    read.mockRestore();
  });

  // A service that refuses a request says why, in a message meant to be
  // shown: the assistant reads it, as the MCP error of its status.
  it('tells a request a service refuses as it says it, as invalid params', async () => {
    logger.error.mockClear();
    const read = jest
      .spyOn(models.Expertises, 'aggregate')
      .mockRejectedValue(createError(404, 'Expertise "qc.gone" not found'));
    const client = await harness.connectAs(f.FRANK);

    const refusal = client.listResources();

    await expect(refusal).rejects.toThrow(/not found/);
    await expect(refusal).rejects.toMatchObject({
      code: ProtocolErrorCode.InvalidParams,
    });
    expect(logger.error).not.toHaveBeenCalled();
    read.mockRestore();
  });

  it('tells a tool a request a service refuses, in its result', async () => {
    const read = jest
      .spyOn(models.Expertises, 'distinct')
      .mockRejectedValue(createError(400, 'This scope is not one'));
    const client = await harness.connectAs(f.FRANK);

    const { error } = harness.answerOf(
      await client.callTool({
        name: 'find_applicable_expertises',
        arguments: { scope: 'subject', categories: ['redaction'] },
      })
    );

    expect(error).toMatch(/This scope is not one/);
    read.mockRestore();
  });

  it('tells nothing of a server error, even one http-errors made', async () => {
    const read = jest
      .spyOn(models.Expertises, 'aggregate')
      .mockRejectedValue(createError(503, 'db.internal is down'));
    const client = await harness.connectAs(f.FRANK);

    const refusal = client.listResources();

    await expect(refusal).rejects.toThrow(/could not answer this request/);
    await expect(refusal).rejects.not.toThrow(/db\.internal/);
    read.mockRestore();
  });

  it('refuses a token the user did not consent to reading with', async () => {
    const client = await harness.connectAs(f.FRANK, { scopes: [] });

    await expect(client.listResources()).rejects.toThrow(/mcp:read/);
  });
});

/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Who may read through MCP (ADR 0012): every role of a company that has MCP
// access, with the rights the user has in the app, checked again on every call
// so a change takes effect without waiting for the token to expire. Every
// primitive the server registers checks it.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');
// The stand-ins the harness put in place of the models.
const models = require('../../../packages/server/common/models.common.js');
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

  it('reads of the company what the handlers use, never its secrets', async () => {
    const { group } = await resolveIdentity({
      scopes: ['mcp:read'],
      extra: { userId: f.FRANK, groupId: f.CLIENT_GROUP },
    });

    expect(group).toEqual({ _id: f.CLIENT_GROUP, enableMcp: true });
  });

  it('refuses a token the user did not consent to reading with', async () => {
    const client = await harness.connectAs(f.FRANK, { scopes: [] });

    await expect(client.listResources()).rejects.toThrow(/mcp:read/);
  });
});

// Arguments a tool's input schema accepts, so that a call reaches the handler
// instead of stopping at the validation of its arguments.
function sampleOf(schema) {
  if (schema.enum) return schema.enum[0];
  if (schema.anyOf) return sampleOf(schema.anyOf[0]);
  switch (schema.type) {
    case 'string':
      return 'any';
    case 'array':
      return [sampleOf(schema.items)];
    case 'object':
      return Object.fromEntries(
        (schema.required || []).map((name) => [
          name,
          sampleOf(schema.properties[name]),
        ])
      );
    default:
      throw new Error(`Teach sampleOf the schema ${JSON.stringify(schema)}`);
  }
}

// Every request a connected application can make that reads data, built from
// what a reader is offered, so a primitive registered later is walked without
// a line here. `tools/list` and `resources/templates/list` are left out: the
// SDK answers them from what is registered, the same to every caller.
async function everyRequest() {
  const reader = await harness.connectAs(f.FRANK);
  const [
    { tools },
    { prompts },
    { resources },
    { resourceTemplates },
  ] = await Promise.all([
    reader.listTools(),
    reader.listPrompts(),
    reader.listResources(),
    reader.listResourceTemplates(),
  ]);
  expect([tools, prompts, resources, resourceTemplates]).not.toContainEqual([]);
  const fill = (template) => template.replace(/\{[^}]+\}/g, 'any');
  return [
    ['prompts/list', (client) => client.listPrompts()],
    ['resources/list', (client) => client.listResources()],
    ...tools.map(({ name, inputSchema }) => [
      `tool ${name}`,
      (client) => client.callTool({ name, arguments: sampleOf(inputSchema) }),
    ]),
    ...prompts.map(({ name }) => [
      `prompt ${name}`,
      (client) => client.getPrompt({ name, arguments: {} }),
    ]),
    ...resources.map(({ uri }) => [
      `resource ${uri}`,
      (client) => client.readResource({ uri }),
    ]),
    ...resourceTemplates.map(({ uriTemplate }) => [
      `template ${uriTemplate}`,
      (client) => client.readResource({ uri: fill(uriTemplate) }),
    ]),
  ];
}

// A tool reports a refusal in its result; anything else rejects.
async function answerTo(request, client) {
  try {
    const result = await request(client);
    return result.isError ? harness.answerOf(result).error : 'answered';
  } catch (error) {
    return error.message;
  }
}

describe('every primitive', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => harness.disconnect());

  it.each([
    ['a company without MCP access', f.NINA, {}, NO_MCP_ACCESS],
    ['a deactivated account', f.DEAN, {}, NO_ACCOUNT],
    ['a token without the read scope', f.FRANK, { scopes: [] }, /mcp:read/],
  ])('refuses %s', async (_case, userId, options, refusal) => {
    const requests = await everyRequest();
    const client = await harness.connectAs(userId, options);

    const answers = await Promise.all(
      requests.map(async ([name, request]) => [
        name,
        await answerTo(request, client),
      ])
    );

    expect(answers.filter(([, answer]) => !refusal.test(answer))).toEqual([]);
  });
});

describe('the static listings', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => harness.disconnect());

  it('answer the same to any caller, since they read nothing', async () => {
    const reader = await harness.connectAs(f.FRANK);
    const refused = await harness.connectAs(f.NINA);

    expect(await refused.listTools()).toEqual(await reader.listTools());
    expect(await refused.listResourceTemplates()).toEqual(
      await reader.listResourceTemplates()
    );
  });
});

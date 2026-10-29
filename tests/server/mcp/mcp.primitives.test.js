/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Every primitive the server registers that reads data checks who calls (ADR
// 0012), walked from what a reader is offered, so one registered later is
// checked without a line here. The listings the SDK answers itself from what
// is registered read nothing, and answer the same to anyone.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const NO_ACCOUNT = /can no longer use LePatron/;
const NO_MCP_ACCESS = /no MCP access/;
// Every scope a token may carry, so the tools a scope adds are walked too.
const EVERY_SCOPE = ['mcp:read', 'skills:write'];

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
  const reader = await harness.connectAs(f.FRANK, { scopes: EVERY_SCOPE });
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
    [
      'a company without MCP access',
      f.NINA,
      { scopes: EVERY_SCOPE },
      NO_MCP_ACCESS,
    ],
    ['a deactivated account', f.DEAN, { scopes: EVERY_SCOPE }, NO_ACCOUNT],
    [
      'a token without the read scope',
      f.FRANK,
      { scopes: ['skills:write'] },
      /mcp:read/,
    ],
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

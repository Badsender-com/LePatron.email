/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// What every tool tells a client about itself (ADR 0012): an output schema,
// since every answer is structured, and whether it only reads. A read-only tool
// runs without a confirmation in the clients that honour the hint; the one tool
// that writes (`submit_feedback`) says it destroys nothing, which ChatGPT checks.
// Written over whatever tools exist, so it holds as each ticket adds its own.
// What the server tells an assistant speaks the glossary's words: a company,
// the platform company, never a group nor the name of the platform's owner.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');
const grammar = require('../../../packages/server/mcp/mcp-tool-grammar.js');
const { siteOrigin } = require('../../../packages/server/utils/site-origin.js');

const WRITING_TOOLS = ['submit_feedback'];

describe('tool contracts', () => {
  let client;
  let tools;

  beforeEach(async () => {
    harness.seed(f.SEED);
    client = await harness.connectAs(f.FRANK);
    ({ tools } = await client.listTools());
  });
  afterEach(() => harness.disconnect());

  it('lists at least the tool of the first ticket', () => {
    expect(tools.map((tool) => tool.name)).toContain(
      'find_applicable_expertises'
    );
  });

  it('declares an output schema for every tool', () => {
    tools.forEach((tool) => {
      expect({ tool: tool.name, type: tool.outputSchema?.type }).toEqual({
        tool: tool.name,
        type: 'object',
      });
    });
  });

  it('marks every tool read-only, but the ones that write', () => {
    tools.forEach((tool) => {
      expect({
        tool: tool.name,
        readOnly: tool.annotations?.readOnlyHint,
      }).toEqual({
        tool: tool.name,
        readOnly: !WRITING_TOOLS.includes(tool.name),
      });
    });
  });

  it('says that a tool that writes destroys nothing', () => {
    tools
      .filter((tool) => WRITING_TOOLS.includes(tool.name))
      .forEach((tool) => {
        expect(tool.annotations).toMatchObject({ destructiveHint: false });
      });
  });

  it('gives every tool a title a person can read', () => {
    tools.forEach((tool) => {
      expect({ tool: tool.name, title: typeof tool.title }).toEqual({
        tool: tool.name,
        title: 'string',
      });
    });
  });

  it('says company, never group nor Badsender, in what it serves', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    const { messages } = await client.getPrompt({
      name: 'redaction.subject-ideas',
      arguments: { prompt: 'A teaser' },
    });
    const served = [
      client.getInstructions(),
      ...tools.flatMap((tool) => [tool.title, tool.description]),
      ...resourceTemplates.flatMap((t) => [t.title, t.description]),
      ...messages.map((message) => message.content.text),
    ].join('\n');

    expect(served).toMatch(/company/);
    expect(served).not.toMatch(/badsender|\bgroups?\b/i);
  });
});

// What the server says of itself when a client connects: what the clients
// show of LePatron beside its name.
describe('the server', () => {
  afterEach(() => harness.disconnect());

  it('describes itself, links to the site and gives its icon', async () => {
    harness.seed(f.SEED);
    const client = await harness.connectAs(f.FRANK);

    expect(client.getServerVersion()).toMatchObject({
      name: 'lepatron',
      title: 'LePatron',
      description: expect.stringMatching(/email production platform/),
      websiteUrl: siteOrigin(),
      icons: [
        {
          src: `${siteOrigin()}/pique_aiguille.svg`,
          mimeType: 'image/svg+xml',
        },
      ],
    });
  });
});

// The grammar every tool follows, read from what the clients are sent, the
// writing tools included: what the MCP specification, the Claude connector
// directory, the ChatGPT app review and Copilot Studio ask of a tool.
describe('the grammar of every tool', () => {
  let tools;
  let prompts;

  beforeEach(async () => {
    harness.seed(f.SEED);
    const client = await harness.connectAs(f.ALICE, {
      group: f.PLATFORM_GROUP,
      scopes: ['mcp:read', 'skills:write'],
    });
    ({ tools } = await client.listTools());
    ({ prompts } = await client.listPrompts());
  });
  afterEach(() => harness.disconnect());

  // How a tool fails is said with the identity (mcp-identity.js): the
  // presets hold what a tool may do, and nothing else.
  it('keeps the four presets of annotations, and only them', () => {
    expect(Object.keys(grammar)).toEqual([
      'READ_ONLY',
      'ADDITIVE',
      'OVERWRITING',
      'SETTING',
    ]);
  });

  const each = (check) =>
    tools.map((tool) => ({ tool: tool.name, ...check(tool) }));

  // No dot, which the Claude and OpenAI APIs refuse, and short enough to stay
  // under 64 once a client prefixes it (mcp__lepatron__…).
  it('names every tool in snake_case, 40 characters at most', () => {
    tools.forEach((tool) => {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
    });
  });

  it('spells out the three hints of every tool', () => {
    const hints = each(({ annotations = {} }) => ({
      readOnly: typeof annotations.readOnlyHint,
      destructive: typeof annotations.destructiveHint,
      openWorld: typeof annotations.openWorldHint,
    }));

    hints.forEach((hint) => {
      expect(hint).toEqual({
        tool: hint.tool,
        readOnly: 'boolean',
        destructive: 'boolean',
        openWorld: 'boolean',
      });
    });
  });

  it('keeps every tool in the closed world of LePatron', () => {
    tools.forEach((tool) => {
      expect({
        tool: tool.name,
        open: tool.annotations.openWorldHint,
      }).toEqual({ tool: tool.name, open: false });
    });
  });

  // They rewrite the open draft.
  it('says the tools that rewrite a draft are destructive', () => {
    const destructive = tools
      .filter((tool) => tool.annotations.destructiveHint)
      .map((tool) => tool.name)
      .sort();

    expect(destructive).toEqual([
      'propose_expertise_change',
      'propose_skill_change',
    ]);
  });

  it('describes every parameter of every tool', () => {
    const undescribed = tools.flatMap((tool) =>
      Object.entries(tool.inputSchema.properties || {})
        .filter(([, schema]) => !schema.description)
        .map(([name]) => `${tool.name}.${name}`)
    );

    expect(undescribed).toEqual([]);
  });

  // Copilot Studio reads one type a field, and an enum as a plain string.
  it('gives every parameter a single type, and names the values of an enum', () => {
    const unions = [];
    const unnamed = [];
    const walk = (where, schema) => {
      if (schema.anyOf || schema.oneOf || Array.isArray(schema.type)) {
        unions.push(where);
      }
      const values = schema.enum || schema.items?.enum;
      if (values && !values.every((v) => schema.description?.includes(v))) {
        unnamed.push(where);
      }
    };
    tools.forEach((tool) =>
      Object.entries(
        tool.inputSchema.properties || {}
      ).forEach(([name, schema]) => walk(`${tool.name}.${name}`, schema))
    );

    expect({ unions, unnamed }).toEqual({ unions: [], unnamed: [] });
  });

  it('describes every argument of every prompt', () => {
    const undescribed = prompts.flatMap((prompt) =>
      (prompt.arguments || [])
        .filter((argument) => !argument.description)
        .map((argument) => `${prompt.name}.${argument.name}`)
    );

    expect(prompts.length).toBeGreaterThan(0);
    expect(undescribed).toEqual([]);
  });
});

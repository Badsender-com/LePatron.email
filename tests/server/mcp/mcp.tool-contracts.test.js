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

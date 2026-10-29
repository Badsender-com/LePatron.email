'use strict';

// What every tool tells a client about itself (ADR 0012): an output schema,
// since every answer is structured, and whether it only reads. A read-only tool
// runs without a confirmation in the clients that honour the hint; the one tool
// that writes (`submit_feedback`) says it destroys nothing, which ChatGPT checks.
// Written over whatever tools exist, so it holds as each ticket adds its own.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const WRITING_TOOLS = ['submit_feedback'];

// Turned on by #1299 (the endpoint, MCP access and the expertises)
describe.skip('tool contracts', () => {
  let tools;

  beforeEach(async () => {
    harness.seed(f.SEED);
    const client = await harness.connectAs(f.FRANK);
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
});

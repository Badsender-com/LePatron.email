'use strict';

// The skills a connected application runs (ADR 0008): each active skill is a
// prompt, its arguments drawn from the skill's input schema, so the assistant
// runs it the platform's way with its own model.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const SUBJECT_IDEAS = 'redaction.subject-ideas';

// Turned on by #1300 (skills as prompts)
describe.skip('skills', () => {
  let client;

  beforeEach(async () => {
    harness.seed(f.SEED);
    client = await harness.connectAs(f.WREN);
  });
  afterEach(() => harness.disconnect());

  it('offers the active skills, and only them', async () => {
    const { prompts } = await client.listPrompts();

    expect(prompts.map((prompt) => prompt.name)).toEqual([SUBJECT_IDEAS]);
  });

  it('describes a skill with its title and description', async () => {
    const { prompts } = await client.listPrompts();

    expect(prompts[0]).toMatchObject({
      name: SUBJECT_IDEAS,
      title: 'Subject line ideas',
      description: 'Three subject lines for an email',
    });
  });

  // `genericTextInput` takes a required prompt, an optional context, and the
  // expertise the server resolves itself: the user never types that one.
  it('takes the arguments of its input schema, the expertise excepted', async () => {
    const { prompts } = await client.listPrompts();

    expect(prompts[0].arguments).toEqual([
      expect.objectContaining({ name: 'prompt', required: true }),
      expect.objectContaining({ name: 'context', required: false }),
    ]);
  });

  it('gives the instructions of the active version, the input filled in', async () => {
    const { messages } = await client.getPrompt({
      name: SUBJECT_IDEAS,
      arguments: { prompt: 'Black Friday teaser', context: 'Fashion, B2C' },
    });
    const text = messages.map((message) => message.content.text).join('\n');

    expect(messages[0].role).toBe('user');
    expect(text).toContain('You write email subject lines for a brand.');
    expect(text).toContain(
      'Give three subject lines, each under 50 characters.'
    );
    expect(text).toContain('Brief: Black Friday teaser\nContext: Fashion, B2C');
  });

  it('refuses to run without a required argument', async () => {
    await expect(
      client.getPrompt({ name: SUBJECT_IDEAS, arguments: { context: 'B2C' } })
    ).rejects.toThrow(/prompt/);
  });

  it('does not run a skill that is not active', async () => {
    await expect(
      client.getPrompt({ name: 'qc.unreleased', arguments: {} })
    ).rejects.toThrow(/not found/i);
  });
});

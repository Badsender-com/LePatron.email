/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The call log of the MCP server (ADR 0012): who called what, from which
// connected application, how long it took and how it ended. Metadata only:
// neither what LePatron answered nor what the user typed is kept. A log goes
// at the end of the group's log retention.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const MS_PER_DAY = 24 * 3600 * 1000;
const SUBJECT_LINES = 'redaction.subject-line';
const COMMENT = 'The subject lines were too long for our brand';

describe('call log', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => harness.disconnect());

  // The call log is written in the background: read once it is.
  const logs = () => harness.callLogs();

  it('logs a call with who made it, from where, and how it ended', async () => {
    const client = await harness.connectAs(f.FRANK, { clientId: 'claude' });

    await client.readResource({
      uri: `lepatron://expertises/${SUBJECT_LINES}`,
    });

    expect(await logs()).toEqual([
      expect.objectContaining({
        _user: f.FRANK,
        _company: f.CLIENT_GROUP,
        clientId: 'claude',
        method: 'resources/read',
        objectIds: [`lepatron://expertises/${SUBJECT_LINES}`],
        outcome: 'ok',
        durationMs: expect.any(Number),
      }),
    ]);
  });

  it('logs the tool called and the ids it was given, not the rest of what was typed', async () => {
    const client = await harness.connectAs(f.FRANK);

    await client.callTool({
      name: 'submit_feedback',
      arguments: {
        rating: 'down',
        comment: COMMENT,
        references: [{ kind: 'expertise', id: SUBJECT_LINES }],
      },
    });

    const [log] = await logs();
    expect(log).toMatchObject({
      method: 'tools/call',
      name: 'submit_feedback',
      objectIds: [SUBJECT_LINES],
    });
    expect(JSON.stringify(log)).not.toContain(COMMENT);
  });

  // The log is read before the tool checks its arguments: it keeps the ids
  // the tool declares, bounded, and nothing else of what was sent.
  describe('what it keeps of the arguments', () => {
    const LONG = 'x'.repeat(100000);
    const callTool = async (name, args) => {
      const client = await harness.connectAs(f.FRANK);
      await client.callTool({ name, arguments: args }).catch(() => null);
      return (await logs())[0];
    };

    it('keeps no argument the tool does not declare, whatever its name', async () => {
      const log = await callTool('submit_feedback', {
        rating: 'up',
        notesId: LONG,
        references: [{ kind: 'skill', id: 'redaction.subject-ideas' }],
      });

      expect(log.outcome).toBe('ok');
      expect(log.objectIds).toEqual(['redaction.subject-ideas']);
      expect(JSON.stringify(log)).not.toContain('xxxx');
    });

    it('cuts an id at 200 characters', async () => {
      const log = await callTool('submit_feedback', {
        rating: 'up',
        references: [{ kind: 'skill', id: LONG }],
      });

      expect(log.objectIds).toEqual(['x'.repeat(200)]);
    });

    it('keeps 20 ids at most', async () => {
      const log = await callTool('submit_feedback', {
        rating: 'up',
        references: Array.from({ length: 5000 }, (_, i) => ({
          kind: 'skill',
          id: `skill-${i}`,
        })),
      });

      expect(log.objectIds).toHaveLength(20);
    });

    it('cuts the name of a tool and a resource at 500 characters', async () => {
      const tool = await callTool(LONG, {});
      const client = await harness.connectAs(f.FRANK);
      await client
        .readResource({ uri: `lepatron://${LONG}` })
        .catch(() => null);
      const resource = (await logs())[1];

      expect(tool.name).toHaveLength(500);
      expect(resource.objectIds[0]).toHaveLength(500);
    });
  });

  it('keeps nothing of what LePatron answered', async () => {
    const client = await harness.connectAs(f.FRANK);

    const { contents } = await client.readResource({
      uri: `lepatron://expertises/${SUBJECT_LINES}`,
    });

    expect(contents[0].text).toContain('Keep the subject under 50 characters.');
    expect(JSON.stringify(await logs())).not.toContain('50 characters');
  });

  it('logs a tool that reported an error as an error', async () => {
    const client = await harness.connectAs(f.FRANK);

    await client.callTool({
      name: 'submit_feedback',
      arguments: {
        rating: 'up',
        references: [{ kind: 'mailing', id: f.M_PROMO }],
      },
    });

    expect((await logs())[0].outcome).toBe('error');
  });

  // A refusal is no failure of the server: the log tells them apart.
  it('logs a call refused to who makes it as refused', async () => {
    const client = await harness.connectAs(f.FRANK);
    harness.update('groups', f.CLIENT_GROUP, { enableMcp: false });

    await expect(client.listResources()).rejects.toThrow();
    await client.callTool({
      name: 'submit_feedback',
      arguments: { rating: 'up' },
    });

    expect(await logs()).toEqual([
      expect.objectContaining({
        _user: f.FRANK,
        method: 'resources/list',
        outcome: 'refused',
      }),
      expect.objectContaining({ method: 'tools/call', outcome: 'refused' }),
    ]);
  });

  it('logs the first call refused by the rate limit, not each one after it', async () => {
    const client = await harness.connectAs(f.FRANK);
    for (let i = 0; i < 60; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await client.listResources();
    }

    await expect(client.listResources()).rejects.toThrow(/limit/i);
    await expect(client.listResources()).rejects.toThrow(/limit/i);

    expect(
      (await logs()).filter((log) => log.outcome === 'rate_limited')
    ).toHaveLength(1);
  });

  it('goes at the end of the group’s log retention', async () => {
    harness.update('groups', f.CLIENT_GROUP, { logRetentionDays: 7 });
    const client = await harness.connectAs(f.FRANK);
    const before = Date.now();

    await client.listResources();

    const { expiresAt } = (await logs())[0];
    expect(new Date(expiresAt).getTime()).toBeGreaterThanOrEqual(
      before + 7 * MS_PER_DAY
    );
    expect(new Date(expiresAt).getTime()).toBeLessThan(before + 8 * MS_PER_DAY);
  });

  // The log is written in the background, its company's retention known from
  // who made the call, or read a minute at most for a call without one.
  describe('what writing it costs a call', () => {
    const models = () =>
      require('../../../packages/server/common/models.common.js');

    it('answers without waiting for the log to be written', async () => {
      let written;
      const create = jest
        .spyOn(models().McpCallLogs, 'create')
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              written = resolve;
            })
        );
      const client = await harness.connectAs(f.FRANK);

      await expect(client.listResources()).resolves.toBeDefined();

      expect(create).toHaveBeenCalledTimes(1);
      written();
      create.mockRestore();
    });

    it('reads the company once for a call, to know who makes it', async () => {
      const client = await harness.connectAs(f.FRANK);
      const findById = jest.spyOn(models().Groups, 'findById');

      await client.listResources();
      await logs();

      expect(findById).toHaveBeenCalledTimes(1);
      findById.mockRestore();
    });

    it('reads the retention of a company once a minute for calls without an identity', async () => {
      const client = await harness.connectAs(f.DEAN);
      const findById = jest.spyOn(models().Groups, 'findById');

      await client.listResources().catch(() => null);
      await logs();
      await client.listResources().catch(() => null);
      const kept = await logs();

      expect(findById).toHaveBeenCalledTimes(1);
      expect(kept.map((log) => log.outcome)).toEqual(['refused', 'refused']);
      findById.mockRestore();
    });
  });

  it('is not logged for a connection that only asks what the server is', async () => {
    await harness.connectAs(f.FRANK);

    expect(await logs()).toEqual([]);
  });
});

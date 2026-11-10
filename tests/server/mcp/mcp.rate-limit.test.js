/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The rate limit of a connected application (ADR 0012): about 60 calls a
// minute per connection, 120 per user across the applications they connect,
// 300 per company, answered beyond that with a message the user understands
// and when to retry. What the call log keeps is pinned by
// mcp.call-log.test.js.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const LIMIT = 60;

describe('rate limit', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => harness.disconnect());

  const callTimes = async (client, times) => {
    for (let i = 0; i < times; i += 1) {
      await client.listResources();
    }
  };

  it(`answers ${LIMIT} calls in a minute`, async () => {
    const client = await harness.connectAs(f.FRANK);

    await expect(callTimes(client, LIMIT)).resolves.toBeUndefined();
  });

  it('refuses the next one with a message saying when to retry', async () => {
    const client = await harness.connectAs(f.FRANK);
    await callTimes(client, LIMIT);

    await expect(client.listResources()).rejects.toThrow(
      /limit.*(retry|try again)/i
    );
  });

  it('says in how many seconds to retry', async () => {
    const client = await harness.connectAs(f.FRANK);
    await callTimes(client, LIMIT);
    harness.advanceClock(45 * 1000);

    const refusal = await client.listResources().catch((error) => error);

    expect(refusal.data).toEqual({ retryAfterSeconds: 15 });
    expect(refusal.message).toMatch(/retry in 15 seconds/i);
  });

  // Anyone may register an application: more of them give a user no more.
  it('caps a user across the applications they connect', async () => {
    const [first, second, third] = await Promise.all(
      ['claude', 'chatgpt', 'copilot'].map((clientId) =>
        harness.connectAs(f.FRANK, { clientId })
      )
    );
    await callTimes(first, LIMIT);
    await callTimes(second, LIMIT);

    await expect(third.listResources()).rejects.toThrow(
      /limit.*account.*(retry|try again)/i
    );
  });

  // A token that no longer opens anything costs its company nothing.
  it('does not count against the company the calls of an account it refuses', async () => {
    const dean = await harness.connectAs(f.DEAN);
    for (let i = 0; i < LIMIT; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await dean.listResources().catch(() => null);
    }
    const connections = await Promise.all(
      [f.FRANK, f.ERIN, f.TESS, f.WREN, f.REX].map((userId) =>
        harness.connectAs(userId)
      )
    );

    for (const client of connections) {
      // eslint-disable-next-line no-await-in-loop
      await expect(callTimes(client, LIMIT)).resolves.toBeUndefined();
    }
  });

  it('answers again the next minute', async () => {
    const client = await harness.connectAs(f.FRANK);
    await callTimes(client, LIMIT);

    harness.advanceClock(61 * 1000);

    await expect(client.listResources()).resolves.toBeDefined();
  });

  it("does not count one user's calls against another's", async () => {
    const frank = await harness.connectAs(f.FRANK);
    const erin = await harness.connectAs(f.ERIN);
    await callTimes(frank, LIMIT);

    await expect(erin.listResources()).resolves.toBeDefined();
  });

  it('caps a whole company, whatever the number of its connections', async () => {
    const connections = await Promise.all(
      [f.FRANK, f.ERIN, f.TESS, f.WREN, f.REX].map((userId) =>
        harness.connectAs(userId)
      )
    );
    for (const client of connections) {
      // eslint-disable-next-line no-await-in-loop
      await callTimes(client, LIMIT);
    }

    // A super admin connected to the company counts against it too.
    const sixth = await harness.connectAs(f.ALICE, { group: f.CLIENT_GROUP });

    await expect(sixth.listResources()).rejects.toThrow(
      /limit.*company.*(retry|try again)/i
    );
  });
});

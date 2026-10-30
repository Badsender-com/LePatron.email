/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The rate limit of a connected application (ADR 0012): about 60 calls a
// minute per connection, answered beyond that with a message the user
// understands. What the call log keeps is pinned by mcp.call-log.test.js.

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

  it('caps a whole group, whatever the number of its connections', async () => {
    const connections = await Promise.all(
      [f.FRANK, f.ERIN, f.TESS, f.WREN, f.REX].map((userId) =>
        harness.connectAs(userId)
      )
    );
    for (const client of connections) {
      // eslint-disable-next-line no-await-in-loop
      await callTimes(client, LIMIT);
    }

    // A super admin connected to the group counts against it too.
    const sixth = await harness.connectAs(f.ALICE, { group: f.CLIENT_GROUP });

    await expect(sixth.listResources()).rejects.toThrow(
      /limit.*group.*(retry|try again)/i
    );
  });
});

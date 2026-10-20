'use strict';

// The rate limit of a connected application (ADR 0008): about 60 calls a
// minute per token, answered beyond that with a message the user understands.
// What the call log keeps (metadata only) and its retention are pinned by the
// tests of #1303 itself: no MCP client can see the log.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const LIMIT = 60;

// Turned on by #1303 (call log and rate limit)
describe.skip('rate limit', () => {
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
});

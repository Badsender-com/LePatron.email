'use strict';

// Whether the domain of a link is on a DNS blocklist: off unless configured,
// and "listed by none" never taken for "clean" when a zone did not answer.
// Google Web Risk has its own tests (quality-web-risk.test.js).

const { deps, run, resetQuality } = require('./quality-resources.harness.js');
const {
  blocklistZones,
  isListing,
} = require('../../../packages/server/mailing/quality-blocklists.service.js');

beforeEach(resetQuality);

describe('blocklists', () => {
  it('are off unless configured', async () => {
    const d = deps();
    const { blocklists } = await run({ links: ['https://a.test'] }, d);
    expect(blocklists).toEqual({ enabled: false, listed: {}, unchecked: [] });
    expect(d.resolve4).not.toHaveBeenCalled();
  });

  it('reads the configured zones', () => {
    expect(
      blocklistZones(
        'Spamhaus DBL=key.dbl.dq.spamhaus.net, multi.surbl.org, bad zone'
      )
    ).toEqual([
      { name: 'Spamhaus DBL', zone: 'key.dbl.dq.spamhaus.net' },
      { name: 'multi.surbl.org', zone: 'multi.surbl.org' },
    ]);
  });

  it("queries the link's registrable domain on every zone", async () => {
    const d = deps({
      zones: () => [
        { name: 'DBL', zone: 'dbl.test' },
        { name: 'URIBL', zone: 'uribl.test' },
      ],
      resolve4: jest.fn(async (name) => {
        if (name === 'shady.co.uk.dbl.test') return ['127.0.1.2'];
        // URIBL refusing the query says nothing about the domain.
        if (name === 'shady.co.uk.uribl.test') return ['127.0.0.1'];
        const error = new Error('ENOTFOUND');
        error.code = 'ENOTFOUND';
        throw error;
      }),
    });
    const { blocklists } = await run(
      { links: ['https://www.shady.co.uk/offer', 'https://fine.test'] },
      d
    );
    expect(blocklists).toEqual({
      enabled: true,
      listed: { 'shady.co.uk': ['DBL'] },
      unchecked: [],
    });
  });

  it('says which domains the blocklists could not answer for, and asks again next time', async () => {
    const zones = () => [
      { name: 'DBL', zone: 'dbl.test' },
      { name: 'URIBL', zone: 'uribl.test' },
    ];
    const d = deps({
      zones,
      resolve4: jest.fn(async (name) => {
        // The resolver is down for one zone; the other refuses the query.
        if (name.endsWith('.dbl.test')) {
          throw Object.assign(new Error('queryA ETIMEOUT'), {
            code: 'ETIMEOUT',
          });
        }
        if (name === 'refused.test.uribl.test') return ['127.0.0.1'];
        throw Object.assign(new Error('queryA ENOTFOUND'), {
          code: 'ENOTFOUND',
        });
      }),
    });
    const links = ['https://fine.test/', 'https://refused.test/'];
    const { blocklists } = await run({ links }, d);
    expect(blocklists).toEqual({
      enabled: true,
      listed: {},
      unchecked: ['fine.test', 'refused.test'],
    });
    // Not "clean": a failure is not kept for the next runs.
    await run({ links }, d, { userKey: 'u2' });
    expect(d.resolve4).toHaveBeenCalledTimes(8);
  });

  it('still reports a listing when another zone could not answer', async () => {
    const d = deps({
      zones: () => [
        { name: 'DBL', zone: 'dbl.test' },
        { name: 'URIBL', zone: 'uribl.test' },
      ],
      resolve4: jest.fn(async (name) => {
        if (name === 'shady.test.dbl.test') return ['127.0.1.2'];
        throw Object.assign(new Error('ETIMEOUT'), { code: 'ETIMEOUT' });
      }),
    });
    const { blocklists } = await run({ links: ['https://shady.test/'] }, d);
    expect(blocklists).toEqual({
      enabled: true,
      listed: { 'shady.test': ['DBL'] },
      unchecked: [],
    });
  });

  it('tells a listing from a refused query', () => {
    expect(isListing('127.0.1.2')).toBe(true);
    expect(isListing('127.0.0.2')).toBe(true);
    expect(isListing('127.0.0.1')).toBe(false);
    expect(isListing('127.255.255.254')).toBe(false);
    expect(isListing('10.0.0.1')).toBe(false);
  });
});

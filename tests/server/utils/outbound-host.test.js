'use strict';

const dns = require('dns');
const {
  assertOutboundHostAllowed,
  isBlockedAddress,
  guardedLookup,
  BLOCKED_HOST_ERROR_CODE,
} = require('../../../packages/server/utils/outbound-host.js');

describe('outbound-host SSRF guard', () => {
  describe('isBlockedAddress (literal IPs, no DNS)', () => {
    const blocked = [
      ['169.254.169.254', 'cloud metadata / link-local'],
      ['127.0.0.1', 'loopback v4'],
      ['10.0.0.1', 'private 10/8'],
      ['172.16.5.5', 'private 172.16/12'],
      ['192.168.1.1', 'private 192.168/16'],
      ['100.64.0.1', 'carrier-grade NAT'],
      ['0.0.0.0', 'unspecified'],
      ['::1', 'loopback v6'],
      ['fe80::1', 'link-local v6'],
      ['fd00::1', 'unique-local v6'],
      ['::ffff:127.0.0.1', 'ipv4-mapped loopback'],
      ['::ffff:169.254.169.254', 'ipv4-mapped metadata'],
    ];
    test.each(blocked)('blocks %s (%s)', (ip) => {
      expect(isBlockedAddress(ip)).toBe(true);
    });

    const allowed = [['8.8.8.8'], ['1.1.1.1'], ['93.184.216.34']];
    test.each(allowed)('allows public unicast %s', (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    });

    it('fails closed on an unparseable address', () => {
      expect(isBlockedAddress('not-an-ip')).toBe(true);
    });
  });

  describe('assertOutboundHostAllowed (literal-IP hosts, no DNS)', () => {
    it('rejects a literal private/link-local IP host', async () => {
      await expect(
        assertOutboundHostAllowed('http://169.254.169.254')
      ).rejects.toThrow();
      await expect(
        assertOutboundHostAllowed('http://127.0.0.1:9000')
      ).rejects.toThrow();
      await expect(
        assertOutboundHostAllowed('https://10.0.0.5/v1/models')
      ).rejects.toThrow();
    });

    it('allows a literal public IP host', async () => {
      await expect(
        assertOutboundHostAllowed('https://8.8.8.8')
      ).resolves.toBeUndefined();
    });

    it('rejects a non-http(s) scheme', async () => {
      await expect(assertOutboundHostAllowed('ftp://8.8.8.8')).rejects.toThrow(
        'Invalid protocol'
      );
      await expect(
        assertOutboundHostAllowed('file:///etc/passwd')
      ).rejects.toThrow();
    });

    it('enforces https-only when requested', async () => {
      await expect(
        assertOutboundHostAllowed('http://8.8.8.8', { httpsOnly: true })
      ).rejects.toThrow('Invalid protocol');
      await expect(
        assertOutboundHostAllowed('https://8.8.8.8', { httpsOnly: true })
      ).resolves.toBeUndefined();
    });

    it('rejects empty / malformed input', async () => {
      await expect(assertOutboundHostAllowed('')).rejects.toThrow();
      await expect(assertOutboundHostAllowed('not a url')).rejects.toThrow();
      await expect(assertOutboundHostAllowed(null)).rejects.toThrow();
    });
  });

  // The resolution the socket connects with — what closes DNS rebinding.
  describe('guardedLookup', () => {
    function resolvesTo(addresses) {
      jest
        .spyOn(dns, 'lookup')
        .mockImplementation((hostname, options, cb) => cb(null, addresses));
    }

    function lookup(options) {
      return new Promise((resolve) => {
        guardedLookup('api.example.com', options, (err, address, family) =>
          resolve({ err, address, family })
        );
      });
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('hands back a validated address (Node 18 asks for one)', async () => {
      resolvesTo([{ address: '93.184.216.34', family: 4 }]);

      const { err, address, family } = await lookup({ family: 0 });

      expect(err).toBeNull();
      expect(address).toBe('93.184.216.34');
      expect(family).toBe(4);
    });

    it('hands back every address when asked for all', async () => {
      const addresses = [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1::1', family: 6 },
      ];
      resolvesTo(addresses);

      const { err, address } = await lookup({ all: true });

      expect(err).toBeNull();
      expect(address).toEqual(addresses);
    });

    // One internal record is enough: the socket may pick any of them.
    it('refuses the name when any address is blocked', async () => {
      resolvesTo([
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);

      const { err } = await lookup({});

      expect(err.code).toBe(BLOCKED_HOST_ERROR_CODE);
    });

    it('passes a resolution failure through', async () => {
      jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, cb) => {
        const error = new Error('nope');
        error.code = 'ENOTFOUND';
        cb(error);
      });

      const { err } = await lookup({});

      expect(err.code).toBe('ENOTFOUND');
    });
  });
});

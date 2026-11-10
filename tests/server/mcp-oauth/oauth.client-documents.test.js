/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The metadata documents the authorization server reads (CIMD, ADR 0012): on
// a public host only, and one answer for every document it cannot use.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const {
  allowFetch,
  isPublicAddress,
  publicOnly,
  checkedDocuments,
} = require('../../../packages/server/mcp/mcp-client-metadata.js');

const URL_OF = 'https://assistant.example.test/oauth/client.json';
const DOCUMENT_REQUEST = {
  method: 'GET',
  headers: { accept: 'application/json' },
  redirect: 'manual',
};
const json = (value, headers = {}) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('the hosts a client document is read on', () => {
  it.each([
    'https://10.0.0.1/client.json',
    'https://127.0.0.1/client.json',
    'https://169.254.169.254/client.json',
    'https://172.16.4.2/client.json',
    'https://192.168.1.10/client.json',
    'https://100.64.0.1/client.json',
    'https://[::1]/client.json',
    'https://[fd12:3456::1]/client.json',
    'https://[fe80::1]/client.json',
    'https://[::ffff:10.0.0.1]/client.json',
    'https://localhost/client.json',
    'https://app.localhost/client.json',
  ])('refuses %s before any request', async (url) => {
    expect(await allowFetch(undefined, url)).toBe(false);
  });

  it.each([URL_OF, 'https://93.184.215.14/client.json'])(
    'reads %s',
    async (url) => {
      expect(await allowFetch(undefined, url)).toBe(true);
    }
  );

  it.each([
    ['10.1.2.3', false],
    ['::ffff:127.0.0.1', false],
    // IPv4 compatible, 6to4, Teredo, local NAT64 and discard-only.
    ['::127.0.0.1', false],
    ['2002:a00:1::', false],
    ['2001:0:4136:e378:8000:63bf:3fff:fdd2', false],
    ['64:ff9b:1::a00:1', false],
    ['100::1', false],
    ['8.8.8.8', true],
    ['2606:4700:4700::1111', true],
    ['not an address', false],
  ])('tells whether %s is public: %s', (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });
});

describe('the address a host resolves to', () => {
  const fetch = jest.fn(async () => json({ client_id: URL_OF }));
  beforeEach(() => fetch.mockClear());

  it.each([
    [[{ address: '10.0.0.5', family: 4 }]],
    [
      [
        { address: '93.184.215.14', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
    ],
    [[{ address: 'fd00::5', family: 6 }]],
    [[]],
  ])('refuses a name that resolves to %j', async (addresses) => {
    const send = publicOnly(fetch, async () => addresses);

    await expect(send(URL_OF, DOCUMENT_REQUEST)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the request with the provider's options, its dispatcher kept", async () => {
    const dispatcher = { checks: 'the address connected to' };
    const options = { ...DOCUMENT_REQUEST, dispatcher };
    const send = publicOnly(fetch, async () => [
      { address: '93.184.215.14', family: 4 },
    ]);

    await send(URL_OF, options);

    expect(fetch).toHaveBeenCalledWith(URL_OF, options);
    expect(fetch.mock.calls[0][1].dispatcher).toBe(dispatcher);
  });
});

describe('a client document read', () => {
  it('keeps its headers, the time it may be cached included', async () => {
    const send = checkedDocuments(async () =>
      json({ client_id: URL_OF }, { 'cache-control': 'max-age=600' })
    );

    const response = await send(URL_OF, DOCUMENT_REQUEST);

    expect(response.headers.get('cache-control')).toBe('max-age=600');
    expect(await response.json()).toEqual({ client_id: URL_OF });
  });

  it.each([
    ['larger than 5 KB', json({ client_id: URL_OF, pad: 'x'.repeat(5200) })],
    ['naming another URL', json({ client_id: 'someone-else' })],
    ['not in JSON', new Response('<html>', { status: 200 })],
    ['answered with an error', new Response('Not found', { status: 404 })],
  ])(
    'fails when it is %s, as an unreachable host does',
    async (_case, answer) => {
      const send = checkedDocuments(async () => answer);
      const unreachable = checkedDocuments(async () => {
        throw new Error('client document unavailable');
      });

      const failure = await send(URL_OF, DOCUMENT_REQUEST).catch((e) => e);

      expect(failure.message).toBe(
        (await unreachable(URL_OF, DOCUMENT_REQUEST).catch((e) => e)).message
      );
    }
  );

  it("leaves the provider's other requests as they are", async () => {
    const answer = new Response('{"keys":[]}', { status: 200 });
    const send = checkedDocuments(async () => answer);

    expect(await send(URL_OF, { method: 'GET' })).toBe(answer);
  });
});

describe('what the authorization page says of a document it cannot use', () => {
  it('says the same of a document that names another URL as of one it cannot read', async () => {
    const app = oauth.createApp();
    const liar = 'https://liar.example.test/oauth/client.json';
    oauth.serveClientMetadata(liar, {
      ...oauth.CIMD_CLIENT,
      client_id: 'someone-else',
    });
    const authorize = (clientId) =>
      request(app)
        .get('/oauth/auth')
        .query(
          oauth.authorizeQuery(
            { ...oauth.CIMD_CLIENT, client_id: clientId },
            oauth.pkce().challenge
          )
        );

    const mismatch = await authorize(liar);
    const unreadable = await authorize(
      'https://nowhere.example.test/oauth/client.json'
    );

    expect(mismatch.status).toBe(400);
    expect(mismatch.status).toBe(unreadable.status);
    expect(mismatch.text).toBe(unreadable.text);
  });
});

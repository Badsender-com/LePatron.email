'use strict';

// node-fetch and the SSRF guard are the two side-effecting deps; mock both so
// the parsing/normalization logic can be tested against fixed payloads.
jest.mock('node-fetch');
jest.mock('../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));

const fetch = require('node-fetch');
const RssProvider = require('../../../packages/server/integration-providers/data-feed/rss-provider.js');
const {
  assertOutboundHostAllowed,
} = require('../../../packages/server/utils/outbound-host.js');

function mockFetchText(text, { ok = true, status = 200 } = {}) {
  fetch.mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(text),
  });
}

function makeProvider(apiHost = 'https://feed.example.com/rss.xml') {
  return new RssProvider({ apiHost, provider: 'rss', type: 'data_feed' });
}

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example</title>
    <item>
      <title>First article</title>
      <link>https://example.com/1</link>
      <description>Hello &lt;b&gt;world&lt;/b&gt;</description>
      <pubDate>Tue, 01 Jul 2025 10:00:00 GMT</pubDate>
      <enclosure url="https://example.com/1.jpg" type="image/jpeg" />
    </item>
    <item>
      <title>Second article</title>
      <link>https://example.com/2</link>
      <description><![CDATA[<p>Body <img src="https://example.com/2.png"/></p>]]></description>
      <pubDate>Wed, 02 Jul 2025 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom</title>
  <entry>
    <title>Atom entry</title>
    <link rel="alternate" href="https://example.com/atom-1" />
    <summary>Atom summary</summary>
    <updated>2025-07-03T10:00:00Z</updated>
  </entry>
</feed>`;

describe('RssProvider.fetchItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the SSRF guard on the feed URL before fetching', async () => {
    mockFetchText(RSS_XML);
    await makeProvider('https://feed.example.com/rss.xml').fetchItems();
    expect(assertOutboundHostAllowed).toHaveBeenCalledWith(
      'https://feed.example.com/rss.xml'
    );
  });

  it('throws (without fetching) when no feed URL is configured', async () => {
    await expect(makeProvider(null).fetchItems()).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('normalizes RSS 2.0 items (title/link/description/image/pubDate)', async () => {
    mockFetchText(RSS_XML);
    const items = await makeProvider().fetchItems();

    expect(items).toHaveLength(2);
    // Sorted newest-first: the 02 Jul item comes before 01 Jul.
    expect(items[0].title).toBe('Second article');
    expect(items[0].link).toBe('https://example.com/2');
    // Image pulled from the <img> inside a CDATA description when no enclosure.
    expect(items[0].image).toBe('https://example.com/2.png');
    expect(items[1].title).toBe('First article');
    // Image pulled from the image/* enclosure.
    expect(items[1].image).toBe('https://example.com/1.jpg');
    expect(items[1].pubDate).toBeInstanceOf(Date);
  });

  it('respects the limit', async () => {
    mockFetchText(RSS_XML);
    const items = await makeProvider().fetchItems({ limit: 1 });
    expect(items).toHaveLength(1);
  });

  it('normalizes Atom entries and prefers rel=alternate links', async () => {
    mockFetchText(ATOM_XML);
    const items = await makeProvider().fetchItems();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Atom entry');
    expect(items[0].link).toBe('https://example.com/atom-1');
    expect(items[0].description).toBe('Atom summary');
  });

  it('throws on a non-ok HTTP response', async () => {
    mockFetchText('', { ok: false, status: 404 });
    await expect(makeProvider().fetchItems()).rejects.toThrow();
  });

  it('throws on unrecognized (non RSS/Atom) content', async () => {
    mockFetchText('<html><body>not a feed</body></html>');
    await expect(makeProvider().fetchItems()).rejects.toThrow();
  });

  it('throws on XML that parses but is neither RSS nor Atom', async () => {
    // fast-xml-parser is lenient, so "malformed" markup often still parses;
    // what must fail is a well-formed document with no channel/feed root.
    mockFetchText('<data><foo>bar</foo></data>');
    await expect(makeProvider().fetchItems()).rejects.toThrow();
  });
});

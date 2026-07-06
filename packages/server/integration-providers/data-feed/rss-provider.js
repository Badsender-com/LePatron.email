'use strict';

const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const { XMLParser } = require('fast-xml-parser');
const BaseProvider = require('../base-provider.js');
const logger = require('../../utils/logger.js');
const { assertOutboundHostAllowed } = require('../../utils/outbound-host.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

const DEFAULT_LIMIT = 10;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * RSS 2.0 / Atom feed provider. Fetches and normalizes feed items into a
 * common shape consumable regardless of the source feed's dialect.
 */
class RssProvider extends BaseProvider {
  async validateCredentials() {
    try {
      await this.fetchItems({ limit: 1 });
      return true;
    } catch (error) {
      logger.error('RSS feed validation error:', error.message);
      return false;
    }
  }

  async fetchItems({ limit = DEFAULT_LIMIT } = {}) {
    const feedUrl = this.apiHost;
    if (!feedUrl) {
      throw new ProviderError('No feed URL configured', CODES.CONFIG_ERROR);
    }

    // SSRF guard at call time (TOCTOU): re-validate the host right before the
    // outbound request, in case DNS changed since the integration was saved.
    await assertOutboundHostAllowed(feedUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let xml;
    try {
      const response = await fetch(feedUrl, { signal: controller.signal });

      if (!response.ok) {
        throw new ProviderError(
          `RSS feed request failed: ${response.status}`,
          CODES.API_ERROR
        );
      }

      xml = await response.text();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ProviderError('RSS feed request timed out', CODES.TIMEOUT);
      }
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        `Failed to fetch RSS feed: ${error.message}`,
        CODES.API_ERROR
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const items = parseFeedItems(xml)
      .sort((a, b) => (b.pubDate?.getTime() || 0) - (a.pubDate?.getTime() || 0))
      .slice(0, limit);

    return items;
  }
}

function parseFeedItems(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
  });

  let doc;
  try {
    doc = parser.parse(xml);
  } catch (error) {
    throw new ProviderError(
      `Failed to parse RSS feed XML: ${error.message}`,
      CODES.INVALID_RESPONSE
    );
  }

  if (doc?.rss?.channel) {
    return toArray(doc.rss.channel.item).map(normalizeRssItem);
  }

  if (doc?.feed) {
    return toArray(doc.feed.entry).map(normalizeAtomEntry);
  }

  throw new ProviderError('Unrecognized feed format', CODES.INVALID_RESPONSE);
}

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeRssItem(item) {
  return {
    title: textOf(item.title),
    link: textOf(item.link),
    description: textOf(item.description),
    image: extractImage(item),
    pubDate: parseDate(item.pubDate),
  };
}

function normalizeAtomEntry(entry) {
  const links = toArray(entry.link);
  const link = links.find((l) => l?.rel === 'alternate') || links[0];

  return {
    title: textOf(entry.title),
    link: textOf(link?.href || link),
    description: textOf(entry.summary || entry.content),
    image: extractImage(entry),
    pubDate: parseDate(entry.updated || entry.published),
  };
}

function extractImage(item) {
  if (item.enclosure?.url && /^image\//.test(item.enclosure.type || '')) {
    return item.enclosure.url;
  }

  const media = toArray(item['media:content'])[0];
  if (media?.url) return media.url;

  const html = textOf(
    item['content:encoded'] || item.description || item.content || item.summary
  );
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && '#text' in value)
    return String(value['#text']);
  return '';
}

function parseDate(value) {
  const raw = textOf(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = RssProvider;

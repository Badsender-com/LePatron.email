'use strict';

const _ = require('lodash');
const url = require('url');
const getSlug = require('speakingurl');

function getName(name) {
  name = name || 'email';
  return getSlug(name.replace(/\.[0-9a-z]+$/, ''));
}

function getImageName(imageUrl) {
  // eslint-disable-next-line node/no-deprecated-api
  const formattedUrlName = url
    .parse(imageUrl)
    .pathname.replace(/\//g, ' ')
    .trim()
    .replace(/\s/g, '-');

  const splittedUrlName = formattedUrlName.split('-');
  let fileName = '';

  // Condition to check if image was upload by the user or if it's an image from template
  if (splittedUrlName[0] === 'api') {
    splittedUrlName.splice(0, 2);

    if (splittedUrlName && splittedUrlName.length === 2) {
      return splittedUrlName[1];
    }

    const coverPart = splittedUrlName[0] || '';
    const hasCoverPart = coverPart.includes('cover');

    // Test if old file name contains a cover value
    if (hasCoverPart) {
      fileName = fileName.concat(coverPart);
      splittedUrlName.splice(0, 1);
    }

    const sizePart =
      (hasCoverPart ? splittedUrlName[1] : splittedUrlName[0]) || '';

    // Test if old file name contains a size value
    const isSizePart = sizePart.match(/\d{1,5}x/g);

    if (isSizePart && isSizePart[0] !== undefined) {
      fileName = fileName.concat('-', sizePart);
      splittedUrlName.splice(0, 1);
    }

    const templateHashPart =
      (coverPart && hasCoverPart ? splittedUrlName[2] : splittedUrlName[0]) ||
      '';

    // Test if old file name contains the hash of template to remove
    const containsTemplateHash =
      templateHashPart && templateHashPart.length > 14;

    if (containsTemplateHash) {
      splittedUrlName.splice(coverPart && hasCoverPart ? 1 : 2, 1);
    }

    // Add the hash of image
    fileName = fileName.concat(
      fileName.length > 0 ? '-' : '',
      splittedUrlName.join('-')
    );
  } else {
    fileName =
      splittedUrlName.length > 1
        ? splittedUrlName[splittedUrlName.length - 2] +
          '-' +
          splittedUrlName[splittedUrlName.length - 1]
        : splittedUrlName[splittedUrlName.length - 1];
  }

  return fileName;
}
const hasUrlAlreadyParams = (url) => {
  return url.includes('?');
};

/**
 * Encode a tracking key/value before injecting it into a URL.
 *
 * We do NOT use encodeURIComponent because tracking values may contain
 * personalization placeholders ({{token}}, [[token]]) that must reach the
 * email client untouched. Instead we escape only the characters that are
 * dangerous in a query string OR that would let the value break out of the
 * surrounding href="..." attribute in the generated HTML:
 *   "  -> escapes the attribute delimiter (HTML injection)
 *   <> -> markup injection
 *   #  -> truncates the URL / starts a fragment
 *   &  -> forges extra query params
 *   space -> breaks the attribute / URL
 * Placeholders are preserved because { } | [ ] are intentionally left alone.
 */
const encodeTrackingComponent = (raw) => {
  return String(raw).replace(/[<>"#& ]/g, (c) => encodeURIComponent(c));
};

// Characters that must be escaped in a regex literal.
const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * Pre-compute everything that depends only on the tracking config (NOT on the
 * link), so it can be built once per email instead of once per link. Called
 * once by handleTrackingData; the returned context is reused for every link.
 */
const buildTrackingContext = (groupTrackingConfig) => {
  const enabled = Boolean(groupTrackingConfig && groupTrackingConfig.enabled);
  const params = enabled ? groupTrackingConfig.params || [] : [];
  return {
    // key -> param definition (value constraints)
    managedParams: new Map(params.map((p) => [p.key, p])),
    restrictValues: Boolean(enabled && groupTrackingConfig.restrictValues),
    // key -> compiled upsert RegExp, built lazily and cached across links
    reCache: new Map(),
  };
};

/**
 * For a managed key, decide which value to actually inject.
 *
 * The `values` list is only a CONSTRAINT when the admin made it one:
 *   - `lockedValues`        → the value is imposed, force the configured one.
 *   - `restrictValues` (group-global) → the value must belong to the list.
 * Otherwise `values` is just a SUGGESTION list and any value (including a
 * custom one typed by the user) is accepted. This mirrors the editor UX:
 * an unlocked, unrestricted list lets the user pick OR type their own.
 *
 * Returns the value to inject, or null to drop the pair entirely.
 */
const resolveManagedValue = (param, value, restrictValues) => {
  const allowed = Array.isArray(param.values) ? param.values : [];
  if (param.lockedValues) {
    return allowed.length > 0 ? allowed[0] : value;
  }
  if (restrictValues && allowed.length > 0) {
    return allowed.includes(value) ? value : null;
  }
  return value;
};

/**
 * Replace (or insert) a query parameter in a URL.
 * Uses regex-based replacement instead of URL API to keep relative paths,
 * template placeholders ({{token}}), and unusual schemes intact.
 * The per-key RegExp is cached on `reCache` so it is compiled once per email,
 * not once per link.
 */
const upsertUrlParam = (link, key, value, reCache) => {
  const encKey = encodeTrackingComponent(key);
  const encValue = encodeTrackingComponent(value);
  let re = reCache && reCache.get(key);
  if (!re) {
    const escapedKey = key.replace(REGEX_ESCAPE, '\\$&');
    re = new RegExp(`([?&])${escapedKey}=[^&#]*`, 'g');
    if (reCache) reCache.set(key, re);
  }
  re.lastIndex = 0;
  if (re.test(link)) {
    return link.replace(re, `$1${encKey}=${encValue}`);
  }
  const sep = hasUrlAlreadyParams(link) ? '&' : '?';
  return `${link}${sep}${encKey}=${encValue}`;
};

const getUrlWithTrackingParams = (
  link,
  tracking,
  groupTrackingConfig,
  context
) => {
  if (!tracking && !groupTrackingConfig) {
    return link;
  }

  // Reuse a pre-built context when provided (hot path: once per email);
  // otherwise build it on the fly (standalone calls / tests).
  const { managedParams, restrictValues, reCache } =
    context || buildTrackingContext(groupTrackingConfig);

  let result = link;
  const freeFormParams = [];

  const handlePair = (key, value) => {
    if (!key || !value) return;
    const managedParam = managedParams.get(key);
    if (restrictValues && !managedParam) return;
    if (managedParam) {
      // Group-controlled key: enforce server-side value constraints, then
      // override the value in the link (or insert if missing).
      const enforced = resolveManagedValue(managedParam, value, restrictValues);
      if (!enforced) return;
      result = upsertUrlParam(result, key, enforced, reCache);
    } else if (!link.includes(key)) {
      // Free-form param: "skip if already present" — inherited from the
      // original tracking implementation (PR #668, commit 3cc1c00a, Feb 2023).
      // No tests, no comment in the original code documents this intent — it
      // looks more like a defensive "don't duplicate" guard than a deliberate
      // product decision. Result: a free-form key that already exists in the
      // link is silently ignored on export, which can surprise users.
      //
      // TODO(product): confirm whether free-form params should also OVERRIDE
      // existing values (like managed params do above) for consistency.
      // Decision pending — see PO note in the tracking-per-company ticket.
      freeFormParams.push(
        `${encodeTrackingComponent(key)}=${encodeTrackingComponent(value)}`
      );
    }
  };

  if (tracking && Array.isArray(tracking.trackingUrls)) {
    for (const trackingUrl of tracking.trackingUrls) {
      handlePair(
        trackingUrl && trackingUrl.key,
        trackingUrl && trackingUrl.value
      );
    }
  }

  if (tracking && tracking.hasGoogleAnalyticsUtm) {
    handlePair(tracking.utmSourceKey, tracking.utmSourceValue);
    handlePair(tracking.utmMediumKey, tracking.utmMediumValue);
    handlePair(tracking.utmCampaignKey, tracking.utmCampaignValue);
  }

  if (freeFormParams.length > 0) {
    const sep = hasUrlAlreadyParams(result) ? '&' : '?';
    result = `${result}${sep}${freeFormParams.join('&')}`;
  }
  return result;
};

function createCdnMarkdownNotice(name, CDN_PATH, relativesImagesNames) {
  return `# mailing – ${name}

## Chemin du CDN

${CDN_PATH}

## Liste des images à mettre sur le CDN :

${relativesImagesNames
  .map((img) => `- [${img}](${CDN_PATH}/${img})`)
  .join('\n')}

## Aperçu des images présentes sur le CDN

${relativesImagesNames
  .map((img) => `![${img}](${CDN_PATH}/${img})`)
  .join('\n\n')}

`;
}
function createHtmlNotice(name, CDN_PATH, relativesImagesNames) {
  return `<!DOCTYPE html>
<style>
  html {
    font-family:  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  }
</style>
<h1>mailing – ${name}</h1>

<h2>Chemin du CDN</h2>

${CDN_PATH}

<h2>Liste des images à mettre sur le CDN</h2>

<ol>
${relativesImagesNames
  .map((img) => `<li><a href="${CDN_PATH}/${img}">${img}</a></li>`)
  .join('\n')}
</ol>

<h2>Aperçu des images présentes sur le CDN</h2>

<ol>
${relativesImagesNames
  .map((img) => `<li><img src="${CDN_PATH}/${img}" /></li>`)
  .join('\n')}
</ol>
`;
}

async function asyncReplace(text, regex, asyncFn) {
  const matches = [...text.matchAll(regex)];

  let result = '';
  let lastIndex = 0;

  // For each match
  for (const match of matches) {
    const [fullMatch] = match;
    const index = match.index;

    // Add all the text between lastIndex and the index of the current match
    result += text.slice(lastIndex, index);

    // Replacement of the matched text asynchronously
    const replacement = await asyncFn(...match);
    result += replacement;

    // Update index by adding all the length we used
    lastIndex = index + fullMatch.length;
  }

  // Rest of the text after the last match
  result += text.slice(lastIndex);

  return result;
}

module.exports = {
  getName,
  getImageName,
  getUrlWithTrackingParams,
  buildTrackingContext,
  createCdnMarkdownNotice,
  createHtmlNotice,
  asyncReplace,
};

'use strict';

// The personalization syntax of the ESPs our clients use, in one place: every
// quality rule that skips, strips or checks merge tags reads it here, and so
// does the server when it screens the subjects and preheaders a model proposes.
//   {{x}} and {% x %} (Handlebars, Liquid), %%x%% (Salesforce), *|X|*
//   (Mailchimp), [[x]], <%= x %> (Adobe Campaign), ${x}, [unsubscribe_link].

// The delimiters that open and close a tag, checked for balance; `%%` both
// opens and closes. `${…}` is left out: its `}` cannot be told from text.
const PAIRS = [
  ['{{', '}}'],
  ['*|', '|*'],
  ['[[', ']]'],
  ['<%', '%>'],
];

// Each delimiter that opens or closes a tag, `${` included.
const DELIMITER = /\{\{|\}\}|\{%|%\}|%%|\*\||\|\*|\[\[|\]\]|<%|%>|\$\{/g;

// A value carrying any of them is only known once the ESP sends the email.
const DYNAMIC_PATTERN = new RegExp(
  `${DELIMITER.source}|\\[[a-z0-9_-]+\\]`,
  'i'
);

// A whole tag, as the recipient never sees it. Each body is bounded: an
// opener left unclosed must not make the scan read on to the end of the text.
const MERGE_TAG = /\{\{[^}]{0,200}\}\}|\{%[^}]{0,200}%\}|%%[^%]{0,200}%%|\*\|[^|]{0,200}\|\*|\[\[[^\]]{0,200}\]\]|<%[\s\S]{0,200}?%>|\$\{[^}]{0,200}\}|\[[a-z0-9_-]+\]/gi;

// ESP scripting that is no markup to balance: <% %> blocks and FreeMarker
// directives (<#list>, </#if>).
const SCRIPTING_MARKUP = /<%[\s\S]{0,2000}?%>|<\/?#[^>]*>/gi;

const isDynamic = (value) => DYNAMIC_PATTERN.test(value || '');

const stripMergeTags = (text) => (text || '').replace(MERGE_TAG, ' ');

// Every whole tag of a text, as written.
const mergeTagsIn = (text) => (text || '').match(MERGE_TAG) || [];

// `[x]`, the one form that also reads as plain text: "[IMPORTANT] Incident".
const BRACKETED_WORD = /^\[[a-z0-9_-]+\]$/i;

module.exports = {
  // Global patterns, to read with match, matchAll or replace, or to compose
  // with: the placing of a spelling correction (text-correction/).
  MERGE_TAG,
  DELIMITER,
  PAIRS,
  SCRIPTING_MARKUP,
  BRACKETED_WORD,
  isDynamic,
  stripMergeTags,
  mergeTagsIn,
};

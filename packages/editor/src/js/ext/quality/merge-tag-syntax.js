'use strict';

// The personalization syntax of the ESPs our clients use, in one place: every
// rule that skips, strips or checks merge tags reads it here.
//   {{x}} (Handlebars, Liquid), %%x%% (Salesforce), *|X|* (Mailchimp),
//   [[x]], <%= x %> (Adobe Campaign), ${x}, [unsubscribe_link].

// The delimiters that open and close a tag, checked for balance; `%%` both
// opens and closes. `${…}` is left out: its `}` cannot be told from text.
const PAIRS = [
  ['{{', '}}'],
  ['*|', '|*'],
  ['[[', ']]'],
  ['<%', '%>'],
];

// A value carrying any of them is only known once the ESP sends the email.
const DYNAMIC_PATTERN = /\{\{|\}\}|%%|\*\||\|\*|\[\[|\]\]|<%|%>|\$\{|\[[a-z0-9_-]+\]/i;

// A whole tag, as the recipient never sees it.
const MERGE_TAG = /\{\{[^}]*\}\}|%%[^%]*%%|\*\|[^|]*\|\*|\[\[[^\]]*\]\]|<%[\s\S]*?%>|\$\{[^}]*\}|\[[a-z0-9_-]+\]/gi;

const isDynamic = (value) => DYNAMIC_PATTERN.test(value || '');

const stripMergeTags = (text) => (text || '').replace(MERGE_TAG, ' ');

module.exports = { PAIRS, isDynamic, stripMergeTags };

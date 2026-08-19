'use strict';

// Shared payloads for the HTML code block characterisation tests.
//
// The product guarantee is deliberately narrow: the block behaves LIKE A TEXT
// BLOCK, no better and no worse. These payloads pin that behaviour down, so a
// future change to the shared export chain shows up as a failing test rather
// than as a broken customer email.
//
// `preserved: true`  -> must come out byte-identical
// `preserved: false` -> is known to be altered today; the test asserts HOW.
//    Those are pre-existing limitations of the shared pipeline, listed in
//    docs/plans/html-code-block.md §6, and deliberately not fixed here.

const ESP_PAYLOADS = [
  // --- Personalization tags that survive the pipeline ---------------------
  { key: 'handlebars', html: '<td>{{firstname}}</td>', preserved: true },
  {
    key: 'handlebars-block',
    html: '<td>{{#if premium}}VIP{{/if}}</td>',
    preserved: true,
  },
  { key: 'percent', html: '<td>%%firstname%%</td>', preserved: true },
  { key: 'mailchimp', html: '<td>*|FNAME|*</td>', preserved: true },
  {
    key: 'adobe-personalize',
    html: '<td><%= recipient.firstName %></td>',
    preserved: true,
  },
  {
    key: 'freemarker',
    // eslint-disable-next-line no-template-curly-in-string -- Freemarker syntax, not a JS template
    html: '<td><#list items as i>${i.name}</#list></td>',
    preserved: true,
  },
  {
    key: 'asp-single-line',
    html: '<td><% if (x) { %>a<% } %></td>',
    preserved: true,
  },

  // --- Email-client specific markup --------------------------------------
  {
    key: 'mso-vml',
    html:
      '<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" arcsize="10%"><v:textbox><center>OK</center></v:textbox></v:roundrect><![endif]-->',
    preserved: true,
  },
  {
    key: 'mso-nested-cond',
    html:
      '<!--[if (gte mso 9)|(lte ie 8)]><table width="570"><tr><td><![endif]-->x<!--[if (gte mso 9)|(lte ie 8)]></td></tr></table><![endif]-->',
    preserved: true,
  },

  // --- Characters that break naive string handling ------------------------
  {
    key: 'dollar-patterns',
    // Every String.replace special pattern: these break a naive replacement
    // string, which is why the export code must use a replacer function.
    html: '<td>$& $1 $` $\' cost $5</td>',
    preserved: true,
  },
  { key: 'cdata-close', html: '<td>a ]]> b</td>', preserved: true },
  {
    key: 'quotes-mixed',
    html: '<td><a href=\'https://a.test\' title="single \'quoted\'">x</a></td>',
    preserved: true,
  },
  {
    key: 'void-tags',
    html: '<td><img src="https://x.test/a.png"><br></td>',
    preserved: true,
  },
  {
    key: 'data-attributes',
    html: '<td data-foo="1" data-bar="2">x</td>',
    preserved: true,
  },

  // --- Known alterations (pre-existing, documented, not fixed here) -------
  {
    key: 'percent-accents',
    html: '<td>%%prénom%%</td>',
    preserved: false,
    // he.encode(..., { decimal: true }) encodes every non-ASCII character.
    expected: '<td>%%pr&#233;nom%%</td>',
  },
  {
    key: 'handlebars-accents',
    html: '<td>{{contact.prénom}}</td>',
    preserved: false,
    expected: '<td>{{contact.pr&#233;nom}}</td>',
  },
  {
    key: 'tabs',
    html: '<td>\ta\tb</td>',
    preserved: false,
    // replaceTabs turns every tab into a space, everywhere.
    expected: '<td> a b</td>',
  },
];

const byKey = (key) => ESP_PAYLOADS.find((payload) => payload.key === key);

module.exports = { ESP_PAYLOADS, byKey };

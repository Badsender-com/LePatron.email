'use strict';

const _ = require('lodash');
const { htmlCodeBlocks, stripCssComments } = require('../html-code');
const { isDynamic } = require('../exported-content');

// Pasted code often comes from a web page: relative addresses that only work
// on that site, addresses without a protocol, and colours an email client
// cannot read.
// Any scheme is a full address here (`whatsapp://`, `ftp:`): what filters
// refuse among them is reported by "forbidden-code".
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const PROTOCOL_RELATIVE = /^\/\//;
const HEX = /#[0-9a-f]+\b/gi;
const VALID_HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const URL_ATTRS = ['href', 'src', 'background'];

// Every address of the markup, as written. An attribute may be empty
// (`href=""`): read one by one, strings only.
function addressesOf(root) {
  return _.uniq(
    _.flatMap(
      Array.from(root.querySelectorAll('[href], [src], [background]')),
      (el) =>
        URL_ATTRS.map((name) => el.getAttribute(name))
          .filter((value) => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
    )
  );
}

const isRelative = (url) =>
  !url.startsWith('#') &&
  !HAS_SCHEME.test(url) &&
  !PROTOCOL_RELATIVE.test(url) &&
  !isDynamic(url);

// The values of CSS declarations only: in a stylesheet, `#fade-in { }` is an
// id selector, not a colour, and a comment is nothing at all.
const declarationValues = (css) =>
  (stripCssComments(css).match(/:[^;{}]+/g) || []).join(' ');

// Hex colours of the wrong length: #ff00f, or the 8-digit #rrggbbaa most
// clients (Outlook first) cannot read.
function invalidColors(root) {
  const values = Array.from(
    root.querySelectorAll('[style], [bgcolor], [color]')
  )
    .map((el) =>
      [
        declarationValues(el.getAttribute('style')),
        el.getAttribute('bgcolor'),
        el.getAttribute('color'),
      ].join(' ')
    )
    .concat(
      Array.from(root.querySelectorAll('style')).map((el) =>
        declarationValues(el.textContent)
      )
    );
  return _.uniq(
    _.flatMap(values, (value) => (value || '').match(HEX) || []).filter(
      (hex) => !VALID_HEX.test(hex)
    )
  );
}

// One finding per kind, its values sorted: the fingerprint must not change
// when the client reorders the code.
const finding = (messageKey, name, values) => ({
  messageKey,
  params: { [name]: values.slice(0, 3).join(', ') },
  value: values.join('|'),
});

module.exports = {
  id: 'loose-code',
  category: 'technical',
  severity: 'warning',
  titleKey: 'Addresses and colours in HTML code',
  passKey: 'The HTML code uses full addresses and valid colours',
  run(ctx) {
    return _.flatMap(htmlCodeBlocks(ctx), (block) => {
      const addresses = addressesOf(block.root);
      const relative = addresses.filter(isRelative).sort();
      const protocolRelative = addresses
        .filter((url) => PROTOCOL_RELATIVE.test(url))
        .sort();
      const colors = invalidColors(block.root).sort();
      const findings = [];
      if (relative.length) {
        findings.push(
          finding(
            'Relative address in the HTML code, it only works on its original site: __urls__',
            'urls',
            relative
          )
        );
      }
      if (protocolRelative.length) {
        findings.push(
          finding(
            'Address without protocol in the HTML code (//…), some email clients cannot open it: __urls__',
            'urls',
            protocolRelative
          )
        );
      }
      if (colors.length) {
        findings.push(
          finding(
            'Colour an email client cannot read in the HTML code: __colors__',
            'colors',
            colors
          )
        );
      }
      return findings.map((f) => ({
        ...f,
        blockId: block.blockId,
        propertyPath: block.path,
      }));
    });
  },
};

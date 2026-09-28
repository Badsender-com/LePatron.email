'use strict';

const _ = require('lodash');
const { htmlCodeBlocks, parseMarkup } = require('../html-code');
const { isDynamic } = require('../exported-content');

// Pasted code often comes from a web page: relative addresses that only work
// on that site, and colours an email client cannot read.
const ABSOLUTE = /^(https?:|mailto:|tel:|sms:|cid:|data:|#)/i;
const HEX = /#[0-9a-f]+\b/gi;
const VALID_HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function relativeUrls(root) {
  return _.uniq(
    Array.from(root.querySelectorAll('[href], [src], [background]'))
      .map((el) => el.getAttribute('href') || el.getAttribute('src') || el.getAttribute('background'))
      .map((url) => url.trim())
      .filter((url) => url && !ABSOLUTE.test(url) && !isDynamic(url))
  );
}

// The values of CSS declarations only: in a stylesheet, `#fade-in { }` is an
// id selector, not a colour.
const declarationValues = (css) =>
  ((css || '').match(/:[^;{}]+/g) || []).join(' ');

// Hex colours of the wrong length: #ff00f, or the 8-digit #rrggbbaa most
// clients (Outlook first) cannot read.
function invalidColors(root) {
  const values = Array.from(root.querySelectorAll('[style], [bgcolor], [color]'))
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

module.exports = {
  id: 'loose-code',
  category: 'technical',
  severity: 'warning',
  titleKey: 'Addresses and colours in HTML code',
  passKey: 'The HTML code uses full addresses and valid colours',
  run(ctx) {
    return _.flatMap(htmlCodeBlocks(ctx), (block) => {
      const root = parseMarkup(ctx, block.html);
      const urls = relativeUrls(root);
      const colors = invalidColors(root);
      const findings = [];
      if (urls.length) {
        findings.push({
          messageKey: 'Relative address in the HTML code, it only works on its original site: __urls__',
          params: { urls: urls.slice(0, 3).join(', ') },
          value: urls.join('|'),
        });
      }
      if (colors.length) {
        findings.push({
          messageKey: 'Colour an email client cannot read in the HTML code: __colors__',
          params: { colors: colors.slice(0, 3).join(', ') },
          value: colors.join('|'),
        });
      }
      return findings.map((f) => ({ ...f, blockId: block.blockId, propertyPath: 'htmlCode' }));
    });
  },
};

'use strict';

const {
  beginExportSubstitution,
  endExportSubstitution,
  registerMarkup,
  substituteMarkers,
} = require('../../../packages/editor/src/js/ext/html-code-block/export-substitution.js');
const {
  ESP_PAYLOADS,
  ESP_CRITICAL_PAYLOADS,
} = require('../../fixtures/esp-payloads.js');

// The regexes of the export cascade that used to mangle pasted markup, copied
// verbatim from viewmodel.js exportHTML. The marker has to survive all of them
// untouched — that is the whole point of substituting last.
const CASCADE = [
  // <script type="text/html"> removal
  (s) =>
    s.replace(
      /<script ([^>]* )?type="text\/html"[^>]*>[\s\S]*?<\/script>/gm,
      ''
    ),
  // Knockout comment removal
  (s) =>
    s.replace(/<!-- ko ((?!--).)*? -->/g, '').replace(/<!-- \/ko -->/g, ''),
  // data-bind / data-mce removal
  (s) => s.replace(/ data-bind="[^"]*"/gm, ''),
  (s) => s.replace(/ data-mce-(href|src|style)="[^"]*"/gm, ''),
  // ESP tag restore — greedy and single-line, the source of the bugs
  (s) => s.replace(/&lt;%.*%&gt;/g, (m) => m),
  (s) => s.replace(/&lt;#list.*&lt;\/#list&gt;/g, (m) => m),
  // void tag self-closing
  (s) =>
    s.replace(
      /(<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)("[^"]*"|[^/">])*)>/gm,
      '$1/>'
    ),
  // blank line removal
  (s) => s.replace(/^\s*[\r\n]/gm, ''),
];

const runCascade = (html) => CASCADE.reduce((acc, step) => step(acc), html);

afterEach(() => {
  endExportSubstitution();
});

describe('export substitution', () => {
  describe('outside an export', () => {
    it('registers nothing, so the binding renders markup directly', () => {
      expect(registerMarkup('<b>x</b>')).toBeNull();
    });

    it('leaves html untouched', () => {
      const html = '<div>@@LPHTMLBLOCK_abc_0@@</div>';
      expect(substituteMarkers(html)).toBe(html);
    });
  });

  describe('during an export', () => {
    beforeEach(() => {
      beginExportSubstitution();
    });

    it('returns a marker instead of the markup', () => {
      const marker = registerMarkup('<table>x</table>');
      expect(marker).toMatch(/^@@LPHTMLBLOCK_[a-z0-9]+_0@@$/);
      expect(marker).not.toContain('<table>');
    });

    it('swaps the marker back for the exact bytes', () => {
      const raw = '<table align="center"><tr><td>Hi</td></tr></table>';
      const marker = registerMarkup(raw);
      expect(substituteMarkers(`<div>${marker}</div>`)).toBe(
        `<div>${raw}</div>`
      );
    });

    it('keeps several blocks apart and in order', () => {
      const a = registerMarkup('<b>first</b>');
      const b = registerMarkup('<i>second</i>');
      expect(substituteMarkers(`<div>${a}</div><div>${b}</div>`)).toBe(
        '<div><b>first</b></div><div><i>second</i></div>'
      );
    });

    it('handles an empty registration', () => {
      const marker = registerMarkup('');
      expect(substituteMarkers(`<div>${marker}</div>`)).toBe('<div></div>');
    });

    it('treats a non-string registration as empty', () => {
      const marker = registerMarkup(undefined);
      expect(substituteMarkers(`<div>${marker}</div>`)).toBe('<div></div>');
    });

    // A replacement STRING would interpret these; the module must use a function.
    it('does not interpret String.replace special patterns in the markup', () => {
      const raw = '<td>$& $1 $` $\' $$ cost $5</td>';
      const marker = registerMarkup(raw);
      expect(substituteMarkers(marker)).toBe(raw);
    });

    it('ignores a marker of another session', () => {
      const stale = '@@LPHTMLBLOCK_stalenonce_0@@';
      expect(substituteMarkers(`<div>${stale}</div>`)).toBe(
        `<div>${stale}</div>`
      );
    });

    it('is not fooled by the marker pattern pasted by the user', () => {
      // The nonce differs from this session's, so the pasted text is left alone.
      const raw = '<td>@@LPHTMLBLOCK_0000_0@@</td>';
      const marker = registerMarkup(raw);
      expect(substituteMarkers(marker)).toBe(raw);
    });

    it('starts a fresh session on every begin', () => {
      registerMarkup('<b>old</b>');
      beginExportSubstitution();
      const marker = registerMarkup('<b>new</b>');
      expect(substituteMarkers(marker)).toBe('<b>new</b>');
    });
  });

  // This is the guarantee the Adobe clients depend on.
  describe('the marker survives the export cascade', () => {
    beforeEach(() => {
      beginExportSubstitution();
    });

    test.each(ESP_CRITICAL_PAYLOADS.map((p) => [p.key, p.html]))(
      '%s comes back byte-perfect',
      (_key, raw) => {
        const marker = registerMarkup(raw);
        const exported = substituteMarkers(
          runCascade(`<div class="lp-html-block">${marker}</div>`)
        );
        expect(exported).toBe(`<div class="lp-html-block">${raw}</div>`);
      }
    );

    test.each(ESP_PAYLOADS.map((p) => [p.key, p.html]))(
      '%s comes back byte-perfect too',
      (_key, raw) => {
        const marker = registerMarkup(raw);
        expect(substituteMarkers(runCascade(marker))).toBe(raw);
      }
    );

    // Cases the cascade mangles when the markup goes through it directly.
    describe('markup the cascade would otherwise have eaten', () => {
      const eaten = [
        ['pasted data-bind', '<div data-bind="text: 1">x</div>'],
        ['pasted ko comment', '<!-- ko if: true --><b>x</b><!-- /ko -->'],
        ['pasted script template', '<script type="text/html">tpl</script>'],
        ['unclosed void tags', '<img src="a.png"><br>'],
        ['blank lines', '<pre>a\n\n\nb</pre>'],
        ['tab indentation', '<td>\n\t<b>x</b>\n</td>'],
        ['accented ESP tag', '<td>%%prénom%%</td>'],
      ];

      test.each(eaten)('%s survives', (_label, raw) => {
        const marker = registerMarkup(raw);
        expect(substituteMarkers(runCascade(marker))).toBe(raw);
      });
    });
  });
});

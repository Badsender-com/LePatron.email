'use strict';

// `printJS` feeds a `<script>` block through Pug's UNESCAPED interpolation
// (`!{ printJS(data) }` in html-templates/mosaico-editor.pug). JSON.stringify does
// not escape `<`, `>` or `/`, so any string in the payload containing `</script>`
// closed the tag and ran what followed on the application origin.
//
// The payload has always carried user-controlled strings — the email name, the
// whole template `data`, and now the subject — so this escaping is the only thing
// standing between them and script execution. Nothing else in the codebase pins it,
// which is why it is pinned here: a reformat or a "simplification" back to a plain
// JSON.stringify would reopen the sink silently.

const {
  exposeHelpersToPug,
} = require('../../../packages/server/mailing/mosaico-editor.controller.js');

const SINK_CHARACTERS = /[<>\u2028\u2029]/;

function printJsOf() {
  const res = { locals: {} };
  const next = jest.fn();
  exposeHelpersToPug({ user: { lang: 'fr' } }, res, next);
  expect(next).toHaveBeenCalled();
  return res.locals.printJS;
}

// Undoes the escaping, to check the value was escaped rather than dropped.
function unescapeUnicode(text) {
  return text.replace(/\\u([0-9A-Fa-f]{4})/g, (_match, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

describe('printJS escaping', () => {
  it.each([
    ['a closing script tag', '</script><script>alert(1)</script>'],
    ['a lone opening bracket', '<img src=x onerror=alert(1)>'],
    ['an HTML comment opener', '<!--'],
    // Legal inside a JSON string but a line terminator in JS: unescaped, it breaks
    // out of the string literal the script block is built from.
    ['U+2028', 'a\u2028b'],
    ['U+2029', 'a\u2029b'],
  ])('leaves no raw sink character for %s', (_case, value) => {
    const output = printJsOf()({ name: value });

    expect(output).not.toMatch(SINK_CHARACTERS);
    expect(JSON.parse(unescapeUnicode(output)).name).toBe(value);
  });

  it('escapes a value nested deep in the template data', () => {
    const output = printJsOf()({ data: { blocks: [{ text: '</script>' }] } });

    expect(output).not.toContain('</script>');
    expect(output).toContain('\\u003C');
  });

  it('still produces parseable JSON for an ordinary payload', () => {
    const payload = { name: 'Soldes', subject: 'Nos nouveautés', n: 3 };
    expect(JSON.parse(printJsOf()(payload))).toEqual(payload);
  });
});

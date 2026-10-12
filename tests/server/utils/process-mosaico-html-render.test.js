'use strict';

// The export's last server pass encodes what it can as entities, then decodes
// the `src` and `href` attributes back. A stylesheet is not markup: what looks
// like an attribute inside it stays encoded, so the head CSS keeps its one
// guarantee — nothing in it can end its own <style>.

const processMosaicoHtmlRender = require('../../../packages/server/utils/process-mosaico-html-render.js');
const {
  injectHeadCss,
} = require('../../../packages/shared/head-css/inject-head-css.js');

const doc = (head, body) =>
  `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

const styleCloses = (html) => (html.match(/<\/style/gi) || []).length;

describe('processMosaicoHtmlRender', () => {
  it('still decodes the src and href of the markup', () => {
    const html = doc(
      '',
      '<a href="https://e.com/?a=1&amp;b=2"><img src="https://e.com/x.png?a=1&amp;b=2"></a>'
    );

    const out = processMosaicoHtmlRender(html);

    expect(out).toContain('href="https://e.com/?a=1&b=2"');
    expect(out).toContain('src="https://e.com/x.png?a=1&b=2"');
  });

  it('leaves what looks like an attribute inside a stylesheet encoded', () => {
    const css = '/* href="&lt;/style&gt;&lt;b&gt;x&lt;/b&gt;" */ .a{color:red}';
    const html = doc(`<style>${css}</style>`, '<p>x</p>');

    const out = processMosaicoHtmlRender(html);

    expect(styleCloses(out)).toBe(1);
    expect(out).toContain('&lt;/style&gt;');
  });

  it('keeps the head CSS inside its own element, end to end', () => {
    const css = '.a{color:red} /* src="&lt;/style&gt;" */';
    const exported = injectHeadCss(doc('<title>x</title>', '<p>x</p>'), css);

    const out = processMosaicoHtmlRender(exported);

    expect(styleCloses(out)).toBe(1);
  });

  it('handles several stylesheets, and markup between them', () => {
    const html = doc(
      '<style>.a{}</style><style type="text/css">.b{}</style>',
      '<a href="a&amp;b">x</a><style>/* href="&amp;" */</style><a href="c&amp;d">y</a>'
    );

    const out = processMosaicoHtmlRender(html);

    expect(out).toContain('href="a&b"');
    expect(out).toContain('href="c&d"');
    expect(out).toContain('/* href="&amp;" */');
  });
});

describe('processMosaicoHtmlRender — stylesheets', () => {
  // Entities are not decoded inside <style>: encoded, `content:"→"` showed the
  // entity and an accented font name matched nothing.
  it('leaves the characters of a stylesheet as written', () => {
    const css = '.a::before{content:"→"} .b{font-family:"Hélvetica"}';
    const out = processMosaicoHtmlRender(
      doc(`<style>${css}</style>`, '<p>é</p>')
    );

    expect(out).toContain(`<style>${css}</style>`);
    // The markup around it is still encoded.
    expect(out).toContain('<p>&#233;</p>');
  });

  it('treats the rest as markup when a <style> is never closed', () => {
    const out = processMosaicoHtmlRender(
      doc('', '<style><a href="a&amp;b">é</a>')
    );

    expect(out).toContain('href="a&b"');
    expect(out).toContain('&#233;');
  });

  // One pass over the document: an unclosed opening does not send the scan
  // back to the end of the input.
  it.each([
    ['unclosed openings', '<style a'],
    ['openings never closed', '<style>'],
  ])('stays linear on %s', (_label, unit) => {
    const html = unit.repeat(150000);
    const start = Date.now();

    processMosaicoHtmlRender(html);

    expect(Date.now() - start).toBeLessThan(500);
  });
});

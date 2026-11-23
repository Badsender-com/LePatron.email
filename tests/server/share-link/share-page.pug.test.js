'use strict';

// The template of the public page, rendered for real: the email stays inside
// a sandboxed srcdoc, and every value is escaped.

describe('share-page.pug', () => {
  const pug = require('pug');
  const path = require('path');
  const render = (locals) =>
    pug.renderFile(
      path.join(
        __dirname,
        '../../../packages/server/html-templates/share-page.pug'
      ),
      locals
    );

  it('keeps the email inside a sandboxed srcdoc, escaped, and runs no script', () => {
    // Links open in a new tab, outside the sandbox; nothing else is allowed.
    const page = render({
      lang: 'fr',
      title: '"><script>alert(1)</script>',
      name: '"><script>alert(1)</script>',
      meta: 'meta',
      html: '<p class="x">Hello</p>"><script>alert(2)</script>',
    });
    expect(page).not.toMatch(/<script/i);
    expect(page).toMatch(
      /<iframe[^>]*sandbox="allow-popups allow-popups-to-escape-sandbox"/
    );
    expect(page).toMatch(/<iframe[^>]*referrerpolicy="no-referrer"/);
    expect(page).toContain('srcdoc="&lt;p class=&quot;x&quot;&gt;Hello');
  });

  it('shows the subject and preheader lines as text, escaped', () => {
    const page = render({
      lang: 'fr',
      title: 't',
      name: 'n',
      meta: 'meta',
      copy: [{ label: 'Objet', value: '<script>alert(3)</script>' }],
      html: '<p>hi</p>',
    });
    expect(page).not.toMatch(/<script/i);
    expect(page).toContain('<dt class="copy__label">Objet</dt>');
    expect(page).toContain('&lt;script&gt;alert(3)&lt;/script&gt;');
    expect(
      render({
        lang: 'fr',
        title: 't',
        name: 'n',
        meta: 'm',
        html: '<p>hi</p>',
      })
    ).not.toContain('class="copy');
  });
});

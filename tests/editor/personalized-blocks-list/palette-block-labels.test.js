/**
 * @jest-environment jsdom
 */

'use strict';

// A saved block's name, category and author are typed by people of the
// company: the palette prints them as text, in both toolbox templates.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');

const TEMPLATES = ['tmpl-badsender', 'tmpl'].map((folder) => ({
  folder,
  markup: fs.readFileSync(
    path.join(
      __dirname,
      `../../../packages/editor/src/${folder}/toolbox.tmpl.html`
    ),
    'utf8'
  ),
}));

const bindingsOnBlockInformation = (markup) =>
  Array.from(
    markup.matchAll(/data-bind="([^"]*)"/g),
    ([, binding]) => binding
  ).filter((binding) => binding.includes('blockInformation'));

// The three labels of a palette block, as the template writes them.
const labels = (markup) =>
  markup.match(
    /<span[^>]*data-bind="[^"]*blockInformation[^"]*"[^>]*>[^<]*<\/span>/g
  );

function render(markup, blockInformation) {
  const host = document.createElement('div');
  host.innerHTML = `<div data-bind="foreach: blocks">${labels(markup).join(
    ''
  )}</div>`;
  document.body.appendChild(host);
  ko.applyBindings(
    {
      blocks: [{ blockInformation }],
      t: (key, params) => key.replace('__name__', params.name),
    },
    host
  );
  return host;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe.each(TEMPLATES)(
  'a saved block in the palette ($folder)',
  ({ markup }) => {
    it('binds its name, category and author with text bindings only', () => {
      const bindings = bindingsOnBlockInformation(markup);

      expect(bindings).toHaveLength(3);
      bindings.forEach((binding) => {
        expect(binding).not.toMatch(/(^|[\s,{])html\s*:/);
        expect(binding).toMatch(/^text\s*:/);
      });
    });

    it('prints its name, category and author as they were typed', () => {
      const host = render(markup, {
        name: '<b>Footer</b>',
        category: 'News & <i>offers</i>',
        userDetails: { name: '<em>Camille</em>' },
      });

      expect(
        Array.from(host.querySelectorAll('span'), (span) => span.textContent)
      ).toEqual(['<b>Footer</b>', 'News & <i>offers</i>', '<em>Camille</em>']);
      expect(host.querySelectorAll('b, i, em')).toHaveLength(0);
    });
  }
);

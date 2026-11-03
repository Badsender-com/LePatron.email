'use strict';

// The text an assistant reads of a mailing (#1304): extracted from its
// sanitised preview, on the shapes real email templates take.

const {
  mailingText,
  variablesOf,
} = require('../../../packages/server/mcp/mcp-mailing-text.js');

const PREHEADER_STYLE =
  'display: none !important; visibility: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-height: 0px; opacity: 0; overflow: hidden;';

const page = (body) =>
  `<html><head><style>p { color: red }</style></head><body>${body}</body></html>`;
const textOf = (body, mailing = {}) => mailingText(mailing, page(body));

describe('mailing text', () => {
  describe('the preheader', () => {
    it("is the template's own field when it declares one", () => {
      const text = textOf(
        `<span style="${PREHEADER_STYLE}">Shown text</span><p>Body</p>`,
        { data: { preheaderText: 'Declared  text' } }
      );

      expect(text).toBe('Preheader: Declared text\n\nBody');
    });

    it('is the hidden text before any visible word otherwise', () => {
      const text = textOf(
        `<span style="${PREHEADER_STYLE}">Up to 50% off&zwnj;&nbsp;&zwnj;&nbsp;</span><p>Body</p>`
      );

      expect(text).toBe('Preheader: Up to 50% off\n\nBody');
    });

    it('is never a block shown on mobile only', () => {
      const text = textOf(
        '<div class="mobile-show" style="display:none">Mobile menu</div><p>Body</p>'
      );

      expect(text).toBe('Body');
    });

    it('is never a hidden text after a visible one', () => {
      expect(
        textOf(`<p>Body</p><span style="${PREHEADER_STYLE}">Late</span>`)
      ).toBe('Body');
    });
  });

  it('reads nested tables in order, one block per cell', () => {
    const text = textOf(
      '<table><tr><td><table><tr><td>Left</td><td>Right</td></tr></table></td></tr><tr><td>Below</td></tr></table>'
    );

    expect(text).toBe('Left\n\nRight\n\nBelow');
  });

  it('keeps a line break inside its paragraph', () => {
    expect(textOf('<p>First line<br>second line</p>')).toBe(
      'First line\nsecond line'
    );
  });

  it('keeps a heading on one line, whatever breaks it', () => {
    expect(textOf('<h2>Big<br>title</h2>')).toBe('## Big title');
  });

  it('gives an image by its alternative text', () => {
    expect(textOf('<p><img src="x.png" alt="Our new shoes"></p>')).toBe(
      'Our new shoes'
    );
  });

  it('gives a card wrapped in one link as blocks, then the link', () => {
    const text = textOf(
      '<a href="https://shop.test/card"><table><tr><td><h2>Card</h2><p>Price <span style="display:none">hidden</span>12 €</p></td></tr></table></a>'
    );

    expect(text).toBe('## Card\n\nPrice 12 €\n\n→ https://shop.test/card');
  });

  it('leaves out a link to nowhere, keeping its words', () => {
    expect(textOf('<p><a href="#">Read more</a></p>')).toBe('Read more');
  });

  it('keeps a link to a variable', () => {
    expect(textOf('<p><a href="{{unsubscribe}}">Unsubscribe</a></p>')).toBe(
      '[Unsubscribe]({{unsubscribe}})'
    );
  });
});

describe('mailing variables', () => {
  it('finds every syntax, in the subject and the HTML alike', () => {
    expect(
      variablesOf(
        { subject: 'Hello {{firstname}}' },
        page(
          '<p>%%FirstName%% [[city]] {{{raw}}}</p><a href="{{ unsubscribe }}">x</a><img alt="[[city]]">'
        )
      )
    ).toEqual(['firstname', 'raw', 'unsubscribe', 'FirstName', 'city']);
  });

  it('never takes a link label for a variable', () => {
    expect(
      variablesOf({}, page('<a href="https://x.test">[SALE]</a>'))
    ).toEqual([]);
  });

  it('never takes a control word for a variable', () => {
    expect(
      variablesOf({}, page('<p>{{#if vip}}VIP{{else}}All{{/if}}</p>'))
    ).toEqual([]);
  });
});

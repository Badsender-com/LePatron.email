'use strict';

// CHARACTERISATION TESTS for the HTML code block.
//
// The product guarantee is narrow on purpose: the block behaves LIKE A TEXT
// BLOCK, no better and no worse. Nothing in the shared export chain was changed
// for it, so these tests pin the chain's ACTUAL behaviour down — including the
// spots where it alters the markup. A future change to that chain then shows up
// as a failing test instead of a broken customer email.
//
// The known alterations are pre-existing limitations listed in
// docs/plans/html-code-block.md §6 and deliberately left untouched.

const processMosaicoHtmlRender = require('../../../packages/server/utils/process-mosaico-html-render.js');
const {
  handleTrackingData,
} = require('../../../packages/server/mailing/mailing.service.js');
const { ESP_PAYLOADS, byKey } = require('../../fixtures/esp-payloads.js');

const preserved = ESP_PAYLOADS.filter((payload) => payload.preserved);
const altered = ESP_PAYLOADS.filter((payload) => !payload.preserved);

describe('HTML code block through the server render pipeline', () => {
  // Same function for the ZIP download, the test send and every ESP export.
  describe('processMosaicoHtmlRender keeps these byte-identical', () => {
    test.each(preserved.map((p) => [p.key, p.html]))('%s', (_key, html) => {
      expect(processMosaicoHtmlRender(html)).toBe(html);
    });
  });

  describe('processMosaicoHtmlRender alters these (known, pre-existing)', () => {
    test.each(altered.map((p) => [p.key, p.html, p.expected]))(
      '%s',
      (_key, html, expected) => {
        expect(processMosaicoHtmlRender(html)).toBe(expected);
      }
    );
  });

  it('documents WHY accented ESP tags are altered', () => {
    // he.encode(..., { decimal: true }) encodes every non-ASCII character, so an
    // accented tag name no longer matches on the ESP side. ASCII tags are safe,
    // which is what the guarantee is scoped to.
    const result = processMosaicoHtmlRender(
      '<td>%%prénom%% %%firstname%%</td>'
    );
    expect(result).toContain('%%pr&#233;nom%%');
    expect(result).toContain('%%firstname%%');
  });

  it('leaves conditional comments and VML alone, unlike a DOM parser would', () => {
    const { html } = byKey('mso-vml');
    const result = processMosaicoHtmlRender(html);
    expect(result).toContain('<!--[if mso]>');
    expect(result).toContain('<v:roundrect');
    expect(result).toContain('<![endif]-->');
  });
});

describe('HTML code block through the tracking rewriter', () => {
  const groupTrackingConfig = {
    enabled: true,
    params: [{ key: 'utm_source' }],
  };
  const tracking = {
    trackingUrls: [{ key: 'utm_source', value: 'newsletter' }],
  };

  const track = (html) =>
    handleTrackingData({ html, tracking, groupTrackingConfig }).html;

  // Decision 9: pasted links are tracked exactly like any other block's links,
  // with no opt-out.
  it('adds tracking params to a pasted http link', () => {
    const result = track('<a href="https://shop.test/page">buy</a>');
    expect(result).toContain('utm_source');
    expect(result).toContain('https://shop.test/page');
  });

  // Not an alteration but a silent no-op worth pinning: a link whose URL is a
  // pure ESP tag has no http scheme, so the rewriter never matches it.
  it('never touches a link whose URL is an ESP tag', () => {
    const html = '<a href="{{unsubscribe_url}}">unsubscribe</a>';
    expect(track(html)).toBe(html);
  });

  it('keeps ESP tags embedded in a tracked URL', () => {
    const result = track(
      '<a href="https://t.test/?u={{id}}&amp;c=%%campaign%%">x</a>'
    );
    expect(result).toContain('{{id}}');
    expect(result).toContain('%%campaign%%');
  });
});

describe('HTML code block through mailing duplication', () => {
  // duplicate() stringifies `data` and replaces every occurrence of the old
  // ObjectId, so a 24-hex string inside pasted markup is rewritten too. Very
  // unlikely, but silent — pinned here rather than fixed.
  it('rewrites a 24-hex string that looks like the source id', () => {
    const oldId = '5f2b1c9d8e7a6b5c4d3e2f10';
    const newId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const data = {
      mainBlocks: {
        blocks: [
          {
            type: 'htmlCodeBlock',
            htmlCode: `<img src="https://cdn.test/${oldId}.png">`,
          },
        ],
      },
    };

    // Exactly what MailingSchema.methods.duplicate does to `data`.
    const rewritten = JSON.parse(
      JSON.stringify(data).replace(new RegExp(oldId, 'gm'), newId)
    );

    expect(rewritten.mainBlocks.blocks[0].htmlCode).toBe(
      `<img src="https://cdn.test/${newId}.png">`
    );
  });

  it('leaves pasted markup alone when it contains no such id', () => {
    const oldId = '5f2b1c9d8e7a6b5c4d3e2f10';
    const htmlCode = '<table><tr><td>{{firstname}}</td></tr></table>';
    const data = {
      mainBlocks: { blocks: [{ type: 'htmlCodeBlock', htmlCode }] },
    };

    const rewritten = JSON.parse(
      JSON.stringify(data).replace(new RegExp(oldId, 'gm'), 'x')
    );

    expect(rewritten.mainBlocks.blocks[0].htmlCode).toBe(htmlCode);
  });
});

describe('the test send and the ZIP export do not agree', () => {
  // Pinned because it is a support trap, not a bug to fix here: sendTestMail
  // applies processMosaicoHtmlRender only, while downloadZip also runs
  // handleTrackingData and rewrites image URLs. "It worked in the test send"
  // therefore does not imply the deliverable is identical.
  it('only the ZIP path adds tracking params', () => {
    const html = '<a href="https://shop.test/page">buy</a>';

    const testSend = processMosaicoHtmlRender(html);
    const zip = processMosaicoHtmlRender(
      handleTrackingData({
        html,
        tracking: { trackingUrls: [{ key: 'utm_source', value: 'news' }] },
        groupTrackingConfig: { enabled: true, params: [{ key: 'utm_source' }] },
      }).html
    );

    expect(testSend).not.toContain('utm_source');
    expect(zip).toContain('utm_source');
  });
});

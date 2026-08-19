/**
 * @jest-environment jsdom
 */

'use strict';

const jQuery = require('jquery');
const {
  detachPastedMarkup,
  restorePastedMarkup,
} = require('../../../packages/editor/src/js/ext/html-code-block/protect-from-inliner.js');

const $ = jQuery;

const buildDoc = (bodyHtml) => {
  document.body.innerHTML = bodyHtml;
  return document;
};

const BLOCK = (inner) =>
  `<table><tr><td><div class="lp-html-block">${inner}</div></td></tr></table>`;

describe('protect-from-inliner', () => {
  it('detaches the pasted markup and puts it back untouched', () => {
    const pasted =
      '<table width="600"><tr><td><img src="a.png"><br>text</td></tr></table>';
    const doc = buildDoc(BLOCK(pasted));
    const holder = () => doc.querySelector('.lp-html-block').innerHTML;
    const before = holder();

    const detached = detachPastedMarkup($, doc);
    expect(holder()).toBe('');
    // Nothing of the pasted markup is reachable while it is detached, which is
    // exactly what keeps the inliner from touching it.
    expect(doc.querySelectorAll('.lp-html-block img')).toHaveLength(0);

    restorePastedMarkup(detached);
    expect(holder()).toBe(before);
  });

  it('preserves comment and text nodes, so conditional comments survive', () => {
    const pasted =
      'lead<!--[if mso]><table><tr><td>outlook</td></tr></table><![endif]-->tail';
    const doc = buildDoc(BLOCK(pasted));
    const detached = detachPastedMarkup($, doc);
    restorePastedMarkup(detached);
    expect(doc.querySelector('.lp-html-block').innerHTML).toBe(pasted);
  });

  it('keeps node order across several blocks', () => {
    const doc = buildDoc(
      BLOCK('<b>one</b><i>two</i>') + BLOCK('<u>three</u><s>four</s>')
    );
    const holders = () =>
      Array.from(doc.querySelectorAll('.lp-html-block')).map(
        (n) => n.innerHTML
      );
    const before = holders();

    restorePastedMarkup(detachPastedMarkup($, doc));
    expect(holders()).toEqual(before);
  });

  it('leaves the wrapper itself in the document', () => {
    const doc = buildDoc(BLOCK('<b>x</b>'));
    detachPastedMarkup($, doc);
    // The wrapper stays, so it keeps behaving like any other template element.
    expect(doc.querySelectorAll('.lp-html-block')).toHaveLength(1);
  });

  it('does nothing when there is no HTML code block', () => {
    const doc = buildDoc('<table><tr><td><b>plain</b></td></tr></table>');
    const before = doc.body.innerHTML;
    const detached = detachPastedMarkup($, doc);
    expect(detached).toEqual([]);
    restorePastedMarkup(detached);
    expect(doc.body.innerHTML).toBe(before);
  });

  it('skips an empty block', () => {
    const doc = buildDoc(BLOCK(''));
    expect(detachPastedMarkup($, doc)).toEqual([]);
  });

  it('tolerates a bad restore argument', () => {
    expect(() => restorePastedMarkup(undefined)).not.toThrow();
    expect(() => restorePastedMarkup(null)).not.toThrow();
  });

  // The point of the whole module: prove a generic template rule reaches a
  // pasted <img> when unprotected, and does not when protected.
  describe('shields the pasted markup from a style sweep', () => {
    const inlineImgBorders = (doc) => {
      $('img', doc).each((index, el) => {
        $(el).attr('style', 'border:0;display:block');
      });
    };

    it('would otherwise style the pasted image', () => {
      const doc = buildDoc(BLOCK('<img src="a.png">'));
      inlineImgBorders(doc);
      expect(
        doc.querySelector('.lp-html-block img').getAttribute('style')
      ).toBe('border:0;display:block');
    });

    it('leaves the pasted image untouched while detached', () => {
      const doc = buildDoc(BLOCK('<img src="a.png">'));
      const detached = detachPastedMarkup($, doc);
      inlineImgBorders(doc);
      restorePastedMarkup(detached);
      expect(
        doc.querySelector('.lp-html-block img').hasAttribute('style')
      ).toBe(false);
    });

    it('still styles template images outside the block', () => {
      const doc = buildDoc(
        '<img src="template.png">' + BLOCK('<img src="pasted.png">')
      );
      const detached = detachPastedMarkup($, doc);
      inlineImgBorders(doc);
      restorePastedMarkup(detached);

      expect(
        doc.querySelector('img[src="template.png"]').getAttribute('style')
      ).toBe('border:0;display:block');
      expect(
        doc.querySelector('img[src="pasted.png"]').hasAttribute('style')
      ).toBe(false);
    });
  });
});

/**
 * @jest-environment jsdom
 */
'use strict';

/**
 * Acceptance tests of the spelling correction (epic #1251, ADR 0005): the
 * field an AI action targets, derived from the element being edited.
 *
 * Mosaico gives each editable element the id `<blockId>_<path>`, the first dot
 * of the path turned into an underscore; that id is the only trace of the
 * field. It is matched against the text fields of the block (#1253), so an
 * underscore in a path cannot be mistaken for a dot.
 */

const BLOCK = `
  <div id="ko_textBlock_3">
    <div id="ko_textBlock_3_titleText" contenteditable="true">
      Les <strong id="inner">soldes</strong> commence
    </div>
    <div id="ko_textBlock_3_button_text" contenteditable="true">Je choisi</div>
    <div id="custom-id" contenteditable="true">Texte</div>
  </div>
  <p id="outside">Hors de tout bloc</p>`;

function render() {
  document.body.innerHTML = BLOCK;
}

const paths = (list) => () => list;

describe('spelling correction: the targeted field', () => {
  let fieldTargetOf;
  let blockTargetOf;

  beforeAll(() => {
    ({
      fieldTargetOf,
      blockTargetOf,
    } = require('../../../packages/editor/src/js/ext/ai-panel/field-target'));
  });

  beforeEach(render);

  it('targets the field of the edited element, in its block', () => {
    const element = document.getElementById('ko_textBlock_3_titleText');
    expect(
      fieldTargetOf(element, { pathsOf: paths(['titleText', 'button.text']) })
    ).toEqual({
      kind: 'blockField',
      blockId: 'ko_textBlock_3',
      blockType: 'textBlock',
      field: 'titleText',
    });
  });

  it('finds a field whose path has a dot', () => {
    const element = document.getElementById('ko_textBlock_3_button_text');
    expect(
      fieldTargetOf(element, { pathsOf: paths(['titleText', 'button.text']) })
        .field
    ).toBe('button.text');
  });

  it('targets the field when the click lands inside its formatting', () => {
    const element = document.getElementById('inner');
    expect(
      fieldTargetOf(element, { pathsOf: paths(['titleText']) }).field
    ).toBe('titleText');
  });

  it('targets nothing when two fields could match the id', () => {
    const element = document.getElementById('ko_textBlock_3_button_text');
    expect(
      fieldTargetOf(element, {
        pathsOf: paths(['button.text', 'button_text']),
      })
    ).toBeNull();
  });

  it.each([
    ['outside any block', 'outside'],
    ['with an id of its own', 'custom-id'],
  ])('targets nothing for an element %s', (_label, id) => {
    expect(
      fieldTargetOf(document.getElementById(id), {
        pathsOf: paths(['titleText']),
      })
    ).toBeNull();
  });

  describe('the block of an element no field matches', () => {
    it('is the block it is in', () => {
      expect(blockTargetOf(document.getElementById('custom-id'))).toEqual({
        kind: 'block',
        blockId: 'ko_textBlock_3',
        blockType: 'textBlock',
      });
    });

    it('is nothing outside any block', () => {
      expect(blockTargetOf(document.getElementById('outside'))).toBeNull();
    });
  });
});

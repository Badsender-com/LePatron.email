'use strict';

// The template contract, version 3 (epic #1547, ADR-0026): besides the root
// properties a template declares and reads, the literals it compares each one
// against, and how many times. The impact of changing a value's identifier
// reads them ("Newsletter compares `be` three times"), and so does the point to
// check "a template compares a literal no value carries".

// Turned on by #1554 (the template contract records the literals it compares)
describe.skip('contract reader v3: compared literals', () => {
  let readTemplateContract;
  let CONTRACT_READER_VERSION;

  beforeAll(() => {
    ({
      readTemplateContract,
      CONTRACT_READER_VERSION,
    } = require('../../../packages/server/template/template-contract.js'));
  });

  const compared = (markup) => readTemplateContract(markup).compared;

  it('records the literal a root property is compared against', () => {
    expect(
      compared('<p data-ko-display="_root_.market eq \'be\'">Belgique</p>')
    ).toEqual({ market: { be: 1 } });
  });

  it('counts each literal as many times as the template compares it', () => {
    const markup = `
      <p data-ko-display="_root_.market eq 'be'">Belgique</p>
      <p data-ko-display="_root_.market eq 'be'">Belgique again</p>
      <p data-ko-display="_root_.market eq 'fr'">France</p>
      <p data-ko-display="_root_.language eq 'fr'">Français</p>`;

    expect(compared(markup)).toEqual({
      market: { be: 2, fr: 1 },
      language: { fr: 1 },
    });
  });

  it('records the literals of `neq`, and of each side of an `or`', () => {
    const markup = `
      <p data-ko-display="_root_.market neq 'ca'">Not Canada</p>
      <p data-ko-display="_root_.market eq 'be' or _root_.market eq 'ch'">Belgium or Switzerland</p>`;

    expect(compared(markup)).toEqual({ market: { ca: 1, be: 1, ch: 1 } });
  });

  it('reads a literal between double quotes', () => {
    expect(
      compared(
        '<p data-ko-display=\'_root_.audience eq "teachers"\'>Teachers</p>'
      )
    ).toEqual({ audience: { teachers: 1 } });
  });

  it('never records a comparison written in a comment', () => {
    const markup = `<!-- _root_.market eq 'uk' is not handled yet -->
      <p data-ko-display="_root_.market eq 'be'">Belgique</p>`;

    expect(compared(markup)).toEqual({ market: { be: 1 } });
  });

  it('never records a block property compared, only root ones', () => {
    const markup = `
      <div data-ko-block="ctaBlock">
        <p data-ko-display="variant eq 'dark'">Dark</p>
      </div>`;

    expect(compared(markup)).toEqual({});
  });

  it('records nothing for a property read without a comparison', () => {
    const markup =
      '<td style="-ko-background-color: @[_root_.mainColorVar]"></td>';

    expect(compared(markup)).toEqual({});
    expect(readTemplateContract(markup).read).toEqual(['mainColorVar']);
  });

  it('gives an empty template an empty record', () => {
    expect(readTemplateContract('').compared).toEqual({});
  });

  // A contract stored by the version 2 reader has no `compared`: it is read
  // again on its next need, as for every version.
  it('is the reader version 3', () => {
    expect(CONTRACT_READER_VERSION).toBe(3);
  });
});

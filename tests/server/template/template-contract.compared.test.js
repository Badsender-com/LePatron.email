'use strict';

// The template contract records the literals it compares (epic #1547,
// ADR-0026): besides the root properties a template declares and reads, the
// literals it compares each one against, and how many times. The impact of
// changing a value's identifier reads them ("Newsletter compares `be` three
// times"), and so does the point to check "a template compares a literal no
// value carries".

const {
  readTemplateContract,
} = require('../../../packages/server/template/template-contract.js');
const {
  contractOfTemplate,
} = require('../../../packages/server/template/template-contract.service.js');

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: { findOne: jest.fn(), updateOne: jest.fn() },
}));
const {
  Templates,
} = require('../../../packages/server/common/models.common.js');

const entry = (property, literal, count = 1) => ({ property, literal, count });

describe('contract reader: compared literals', () => {
  const compared = (markup) => readTemplateContract(markup).compared;

  it('records the literal a root property is compared against', () => {
    expect(
      compared('<p data-ko-display="_root_.market eq \'be\'">Belgique</p>')
    ).toEqual([entry('market', 'be')]);
  });

  it('counts each literal as many times as the template compares it', () => {
    const markup = `
      <p data-ko-display="_root_.market eq 'be'">Belgique</p>
      <p data-ko-display="_root_.market eq 'be'">Belgique again</p>
      <p data-ko-display="_root_.market eq 'fr'">France</p>
      <p data-ko-display="_root_.language eq 'fr'">Français</p>`;

    expect(compared(markup)).toEqual([
      entry('language', 'fr'),
      entry('market', 'be', 2),
      entry('market', 'fr'),
    ]);
  });

  it('records the literals of `neq`, and of each side of an `or`', () => {
    const markup = `
      <p data-ko-display="_root_.market neq 'ca'">Not Canada</p>
      <p data-ko-display="_root_.market eq 'be' or _root_.market eq 'ch'">Belgium or Switzerland</p>`;

    expect(compared(markup)).toEqual([
      entry('market', 'be'),
      entry('market', 'ca'),
      entry('market', 'ch'),
    ]);
  });

  it('reads a literal between double quotes, or holding the other quote', () => {
    const markup = `
      <p data-ko-display='_root_.audience eq "teachers"'>Teachers</p>
      <p data-ko-display='_root_.audience eq "l&apos;atelier"'>Workshop</p>`;

    expect(compared(markup)).toEqual([
      entry('audience', "l'atelier"),
      entry('audience', 'teachers'),
    ]);
  });

  it('reads a comparison written the other way round', () => {
    expect(
      compared('<p data-ko-display="\'be\' eq _root_.market">Belgique</p>')
    ).toEqual([entry('market', 'be')]);
  });

  it('reads quotes a template wrote as entities', () => {
    expect(
      compared(
        '<p data-ko-display="_root_.market eq &quot;be&quot;">Belgique</p>'
      )
    ).toEqual([entry('market', 'be')]);
  });

  it('never reads a property ending in `eq` as a comparison', () => {
    expect(
      compared('<p data-ko-display="_root_.marketneq \'x\'">X</p>')
    ).toEqual([]);
  });

  it('keeps a literal holding a dot as it is written', () => {
    expect(
      compared('<p data-ko-display="_root_.market eq \'fr.be\'">BE</p>')
    ).toEqual([entry('market', 'fr.be')]);
  });

  it('records a property an object reserves like any other, and touches no object', () => {
    const markup = `
      <p data-ko-display="_root_.__proto__ eq 'shared'">A</p>
      <p data-ko-display="_root_.constructor eq 'shared'">B</p>`;

    expect(compared(markup)).toEqual([
      entry('__proto__', 'shared'),
      entry('constructor', 'shared'),
    ]);
    expect({}.shared).toBeUndefined();
    expect(Object.shared).toBeUndefined();
  });

  it('never records a comparison written in a comment', () => {
    const markup = `<!-- _root_.market eq 'uk' is not handled yet -->
      <p data-ko-display="_root_.market eq 'be'">Belgique</p>`;

    expect(compared(markup)).toEqual([entry('market', 'be')]);
  });

  it('never records a block property compared, only root ones', () => {
    const markup = `
      <div data-ko-block="ctaBlock">
        <p data-ko-display="variant eq 'dark'">Dark</p>
      </div>`;

    expect(compared(markup)).toEqual([]);
  });

  it('records nothing for a property read without a comparison', () => {
    const markup =
      '<td style="-ko-background-color: @[_root_.mainColorVar]"></td>';

    expect(compared(markup)).toEqual([]);
    expect(readTemplateContract(markup).read).toEqual(['mainColorVar']);
  });

  it('gives an empty template an empty record', () => {
    expect(readTemplateContract('').compared).toEqual([]);
  });
});

// Acceptance test of #1547 (ADR-0026, "a template compares `fr`, which is
// not offered under Canada"): the comparisons made together in one expression.
describe('contract reader: literals compared together', () => {
  const together = (markup) => readTemplateContract(markup).comparedTogether;
  const pair = (property, literal, withProperty, withLiteral, count = 1) => ({
    property,
    literal,
    withProperty,
    withLiteral,
    count,
  });

  it('records two root properties compared in one expression, in name order', () => {
    const markup = `
      <p data-ko-display="_root_.market eq 'ca' and _root_.language eq 'fr'">A</p>
      <p data-ko-display="_root_.language eq &quot;en&quot; and _root_.market eq &quot;ca&quot;">B</p>
      <p data-ko-display="_root_.language eq 'fr' and _root_.market eq 'ca'">C</p>`;

    expect(together(markup)).toEqual([
      pair('language', 'en', 'market', 'ca'),
      pair('language', 'fr', 'market', 'ca', 2),
    ]);
  });

  it('never pairs comparisons of nested elements, nor two of one property', () => {
    const markup = `
      <div data-ko-display="_root_.market eq 'be'">
        <p data-ko-display="_root_.language eq 'nl'">Nested</p>
      </div>
      <p data-ko-display="_root_.market eq 'be' or _root_.market eq 'ch'">Same</p>`;

    expect(together(markup)).toEqual([]);
  });

  it('gives an empty template an empty record', () => {
    expect(readTemplateContract('').comparedTogether).toEqual([]);
  });
});

describe('a contract stored by an older reader', () => {
  beforeEach(() => {
    Templates.findOne.mockReset();
    Templates.updateOne.mockReset();
  });

  it('is read again from the markup, with its compared literals', async () => {
    const stored = {
      _id: 'tpl-1',
      markup: '<p data-ko-display="_root_.market eq \'be\'">Belgique</p>',
      contract: { declared: {}, read: ['market'], adopt: {}, compared: {} },
      contractVersion: 3,
    };
    Templates.findOne.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(stored) }),
    });

    const contract = await contractOfTemplate('tpl-1');

    expect(contract.compared).toEqual([entry('market', 'be')]);
  });
});

'use strict';

// Acceptance tests of the template contract (epics #1514 and #1515, ADR-0024):
// what a template declares and reads at its root, read by the server from its
// markup. It decides which dimensions an email of that template offers, and
// where their values are adopted from.

const {
  TEMPLATE_READING_SILO_AND_BRAND,
} = require('./template-contract.fixtures.js');

// Turned on by #1520 (the server reads the template contract)
describe('template contract', () => {
  let readTemplateContract;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1520.
    ({
      readTemplateContract,
    } = require('../../../packages/server/template/template-contract.js'));
  });

  it('lists the root properties the template declares, with their defaults', () => {
    const contract = readTemplateContract(TEMPLATE_READING_SILO_AND_BRAND);

    expect(contract.declared).toEqual({
      headerVisible: 'true',
      silo: 'youth',
      siloBrand: 'little_reader',
      mainColorVar: '#000000',
    });
  });

  it('lists a root property only read in an expression, never declared', () => {
    const contract = readTemplateContract(TEMPLATE_READING_SILO_AND_BRAND);

    expect(contract.read).toEqual(
      expect.arrayContaining(['audience', 'ctaColorVar', 'mainColorVar'])
    );
  });

  it('reads `_root_.x` in a display condition, a style binding and an attribute binding', () => {
    const markup = `
      <div data-ko-display="_root_.season eq 'winter'"></div>
      <td style="-ko-background-color: @[_root_.bannerColor]"></td>
      <img style="-ko-attr-src: @['https://img.example/' + _root_.logoFolder + '/logo.png']">`;

    expect(readTemplateContract(markup).read.sort()).toEqual([
      'bannerColor',
      'logoFolder',
      'season',
    ]);
  });

  it('never counts a block property as a root one', () => {
    const markup = `
      <div data-ko-block="ctaBlock">
        <a style="-ko-background-color: @[buttonStyle.bgColor]"></a>
      </div>`;

    expect(readTemplateContract(markup)).toMatchObject({
      declared: {},
      read: [],
    });
  });

  it('gives the adoption source a template declares for a renamed property', () => {
    const contract = readTemplateContract(TEMPLATE_READING_SILO_AND_BRAND);

    expect(contract.adopt).toEqual({ siloBrand: 'brand_[silo]' });
  });

  it('reads an empty contract from a template with no root property', () => {
    expect(
      readTemplateContract('<table><tr><td>Hi</td></tr></table>')
    ).toEqual({ declared: {}, read: [], adopt: {} });
    expect(readTemplateContract(null)).toEqual({
      declared: {},
      read: [],
      adopt: {},
    });
  });
});

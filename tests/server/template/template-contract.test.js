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

  it('never counts a `_root_.x` written in a comment', () => {
    const markup = `<!-- Reads _root_.brand and _root_.sm: documentation only -->
      <div data-ko-display="_root_.market eq 'ca'">Canada</div>`;

    expect(readTemplateContract(markup).read).toEqual(['market']);
  });

  it('reads `_root_.x` inside an Outlook conditional comment, which is markup', () => {
    const markup = `<!--[if mso]>
      <td style="-ko-background-color: @[_root_.mainColorVar]"></td>
    <![endif]-->`;

    expect(readTemplateContract(markup).read).toEqual(['mainColorVar']);
  });

  it('reads `_root_.x` in the markup hidden from Outlook only', () => {
    const markup = `<!--[if !mso]><!-->
      <div data-ko-display="_root_.audience eq 'teachers'">Teachers</div>
    <!--<![endif]-->`;

    expect(readTemplateContract(markup).read).toEqual(['audience']);
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

// Review of the stack: the contract is read on user requests, so a malformed
// template must not hold the server. Each read goes through the markup once.
describe('template contract of a malformed template', () => {
  let readTemplateContract;

  beforeAll(() => {
    ({
      readTemplateContract,
    } = require('../../../packages/server/template/template-contract.js'));
  });

  const quickly = (markup) => {
    const started = Date.now();
    readTemplateContract(markup);
    return Date.now() - started;
  };
  const LARGE = 400000;

  it('reads an unclosed definition in linear time', () => {
    expect(quickly(`<style>${'a'.repeat(LARGE)}{</style>`)).toBeLessThan(1000);
  });

  it('reads unclosed style blocks and comments in linear time', () => {
    expect(quickly('<style>'.repeat(LARGE / 7))).toBeLessThan(1000);
    expect(quickly('<!--'.repeat(LARGE / 4))).toBeLessThan(1000);
  });

  it('still reads a definition after an unclosed brace', () => {
    const markup = `<style>
      broken {
      siloBrand { label: Marque; adopt: brand_[silo]; }
    </style>`;

    expect(readTemplateContract(markup).adopt).toEqual({
      siloBrand: 'brand_[silo]',
    });
  });

  it('reads past a comment left unclosed', () => {
    expect(
      readTemplateContract('<p data-ko-display="_root_.market">x</p><!-- end')
        .read
    ).toEqual(['market']);
  });
});

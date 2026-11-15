'use strict';

// What an email of a template proposes (epic #1547): the dimensions in its
// scope, their values, under which parent value each child value is offered,
// the defaults, and the design tokens it reads that a value carries. The same
// rules as the editor (ADR-0024), read on the taxonomy workspace so the tech
// admin checks the taxonomy against a real template.

const {
  DIMENSIONS,
  VALUES,
  TEMPLATES,
} = require('./taxonomy-workspace.fixtures.js');

const template = (id) => TEMPLATES.find((t) => t.id === `tpl-${id}`);

describe('values a template proposes', () => {
  let valuesProposed;
  let templatesReading;

  beforeAll(() => {
    ({
      valuesProposed,
      templatesReading,
    } = require('~/helpers/taxonomy-preview.js'));
  });

  const proposed = (id, values = VALUES) =>
    valuesProposed({ template: template(id), dimensions: DIMENSIONS, values });
  const dimensionOf = (preview, name) =>
    preview.dimensions.find((d) => d.name === name);

  it('lists the dimensions in the scope of the template, in the order of the tree', () => {
    expect(proposed('newsletter').dimensions.map((d) => d.name)).toEqual([
      'emailType',
      'trigger',
      'market',
      'language',
      'brand',
      'audience',
    ]);
  });

  it('leaves out a dimension only the templates reading it offer', () => {
    expect(proposed('transactional').dimensions.map((d) => d.name)).toEqual([
      'emailType',
      'trigger',
      'market',
      'language',
      'audience',
    ]);
  });

  it("shows the trigger's two doctrine values", () => {
    expect(dimensionOf(proposed('newsletter'), 'trigger').values).toEqual([
      'adhoc',
      'automated',
    ]);
  });

  it("takes the template's own default before the company's", () => {
    const preview = proposed('newsletter');

    expect(dimensionOf(preview, 'market')).toMatchObject({
      values: ['mk-fr', 'mk-be', 'mk-ch', 'mk-ca', 'mk-de'],
      defaultValue: 'mk-fr',
    });
    expect(dimensionOf(preview, 'brand')).toMatchObject({
      values: ['br-atlas', 'br-nova'],
      defaultValue: 'br-atlas',
    });
  });

  it('gives a child dimension its values and its default under each parent value', () => {
    expect(dimensionOf(proposed('newsletter'), 'language')).toMatchObject({
      under: {
        'mk-fr': ['lg-fr'],
        'mk-be': ['lg-fr', 'lg-nl'],
        'mk-ch': ['lg-fr', 'lg-de', 'lg-it'],
        'mk-ca': ['lg-en'],
        'mk-de': [],
      },
      defaultUnder: {
        'mk-fr': 'lg-fr',
        'mk-be': 'lg-fr',
        'mk-ch': 'lg-fr',
        'mk-ca': 'lg-en',
      },
    });
  });

  it('never proposes a deactivated value', () => {
    const values = VALUES.map((v) =>
      v.id === 'lg-it' ? { ...v, isActive: false } : v
    );

    expect(
      dimensionOf(proposed('newsletter', values), 'language').under['mk-ch']
    ).toEqual(['lg-fr', 'lg-de']);
  });

  it('offers every value of a child whose parent is out of scope', () => {
    const preview = proposed('catalogue');

    expect(preview.dimensions.map((d) => d.name)).toEqual([
      'emailType',
      'trigger',
      'market',
      'language',
      'range',
      'audience',
    ]);
    expect(dimensionOf(preview, 'range').values).toEqual(['rg-junior']);
    expect(dimensionOf(preview, 'range').under).toBeUndefined();
  });

  // Review of #1547: the editor's rule for a child, in its order.
  it("gives a child the template's own default before the star", () => {
    const declaringDutch = {
      ...template('transactional'),
      contract: {
        ...template('transactional').contract,
        declared: { language: 'nl' },
      },
    };
    const preview = valuesProposed({
      template: declaringDutch,
      dimensions: DIMENSIONS,
      values: VALUES,
    });

    expect(dimensionOf(preview, 'language').defaultUnder['mk-be']).toBe(
      'lg-nl'
    );
    expect(dimensionOf(preview, 'language').defaultUnder['mk-fr']).toBe(
      'lg-fr'
    );
  });

  it('gives a child the only value offered under a parent value, starred or not', () => {
    const values = VALUES.map((v) =>
      v.id === 'lg-en' ? { ...v, defaultUnder: [] } : v
    );

    expect(
      dimensionOf(proposed('newsletter', values), 'language').defaultUnder[
        'mk-ca'
      ]
    ).toBe('lg-en');
  });

  it('gives the email type no default, which it never has', () => {
    const values = VALUES.map((v) =>
      v.type === 'emailType' ? { ...v, isDefault: true } : v
    );

    expect(
      dimensionOf(proposed('newsletter', values), 'emailType').defaultValue
    ).toBeUndefined();
  });

  it('lists the design tokens the template reads that a value carries', () => {
    expect(proposed('newsletter').tokens).toEqual(['logoUrl', 'mainColorVar']);
    expect(proposed('transactional').tokens).toEqual([]);
  });

  it.each([
    ['brand', ['Newsletter v4']],
    ['market', ['Newsletter v4', 'Transactionnel']],
    ['range', ['Catalogue']],
    ['audience', []],
  ])('names the templates reading %s', (name, expected) => {
    expect(
      templatesReading({
        dimension: DIMENSIONS.find((d) => d.name === name),
        templates: TEMPLATES,
        values: VALUES,
      }).map((t) => t.name)
    ).toEqual(expected);
  });
});

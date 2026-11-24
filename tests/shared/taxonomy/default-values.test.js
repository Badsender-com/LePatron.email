'use strict';

// Acceptance tests of where an empty dimension takes its value from (epic
// #1514, ADR-0024), the one rule the editor and the server share: the template's
// own default (the value its contract declares for the property, when a value
// carries that identifier); then the company's default, marked on a value, or
// for a child value "default under" a parent value; then the only value offered
// under the parent; then nothing.
//
// `selections` maps a dimension name to a value id. `changed` names the
// dimensions the user just changed: only their descendants are looked at.
// Absent, every dimension is (an email being created).

const SILO = {
  name: 'silo',
  values: [
    { id: 'youth', canonicalType: 'youth', isActive: true },
    { id: 'school', canonicalType: 'school', isActive: true, isDefault: true },
    { id: 'travel', canonicalType: 'travel', isActive: true },
  ],
};

const SILO_BRAND = {
  name: 'siloBrand',
  parentName: 'silo',
  values: [
    {
      id: 'little',
      canonicalType: 'little_reader',
      isActive: true,
      parentIds: ['youth'],
      defaultUnder: ['youth'],
    },
    {
      id: 'big',
      canonicalType: 'big_reader',
      isActive: true,
      parentIds: ['youth'],
    },
    {
      id: 'blue',
      canonicalType: 'blue_notebooks',
      isActive: true,
      parentIds: ['school'],
    },
    {
      id: 'red',
      canonicalType: 'red_notebooks',
      isActive: true,
      parentIds: ['school'],
      defaultUnder: ['school'],
    },
    // The only brand of its silo: no default needed.
    {
      id: 'atlas',
      canonicalType: 'atlas',
      isActive: true,
      parentIds: ['travel'],
    },
  ],
};

const AUDIENCE = {
  name: 'audience',
  values: [{ id: 'teachers', canonicalType: 'teachers', isActive: true }],
};

let resolveDefaults;

beforeAll(() => {
  // Required here: the module doesn't exist until #1523.
  resolveDefaults = (params) =>
    require('../../../packages/shared/taxonomy/default-values.js').resolveDefaults(
      params
    );
});

// Turned on by #1523 (a default value at the first level)
describe.skip('default value at the first level', () => {
  it("starts a new email on the company's default", () => {
    expect(resolveDefaults({ dimensions: [SILO], selections: {} })).toEqual({
      silo: 'school',
    });
  });

  it("prefers the template's own default, when a value carries its identifier", () => {
    expect(
      resolveDefaults({
        dimensions: [SILO],
        selections: {},
        templateDefaults: { silo: 'travel' },
      })
    ).toEqual({ silo: 'travel' });
  });

  it("falls back on the company's default when no value carries the template's", () => {
    expect(
      resolveDefaults({
        dimensions: [SILO],
        selections: {},
        templateDefaults: { silo: 'cookery' },
      })
    ).toEqual({ silo: 'school' });
  });

  it('leaves empty a first-level dimension with no default, even with a single value', () => {
    expect(resolveDefaults({ dimensions: [AUDIENCE], selections: {} })).toEqual(
      {}
    );
  });

  it('never replaces a value already chosen', () => {
    expect(
      resolveDefaults({ dimensions: [SILO], selections: { silo: 'youth' } })
    ).toEqual({ silo: 'youth' });
  });

  it('never takes a deactivated value as a default', () => {
    const retired = {
      ...SILO,
      values: SILO.values.map((value) =>
        value.id === 'school' ? { ...value, isActive: false } : value
      ),
    };

    expect(resolveDefaults({ dimensions: [retired], selections: {} })).toEqual(
      {}
    );
  });
});

// Turned on by #1524 (the default value of a child dimension)
describe.skip('default value of a child dimension', () => {
  const both = [SILO, SILO_BRAND];

  it('lands a new email on the default brand of the default silo', () => {
    expect(resolveDefaults({ dimensions: both, selections: {} })).toEqual({
      silo: 'school',
      siloBrand: 'red',
    });
  });

  it('lands on the default brand of the silo the user picks', () => {
    expect(
      resolveDefaults({
        dimensions: both,
        selections: { silo: 'youth' },
        changed: ['silo'],
      })
    ).toEqual({ silo: 'youth', siloBrand: 'little' });
  });

  it('takes the only brand offered under the silo, with no default set', () => {
    expect(
      resolveDefaults({
        dimensions: both,
        selections: { silo: 'travel' },
        changed: ['silo'],
      })
    ).toEqual({ silo: 'travel', siloBrand: 'atlas' });
  });

  it('replaces a brand the new silo does not offer by its default', () => {
    expect(
      resolveDefaults({
        dimensions: both,
        selections: { silo: 'school', siloBrand: 'big' },
        changed: ['silo'],
      })
    ).toEqual({ silo: 'school', siloBrand: 'red' });
  });

  it('empties a brand the new silo does not offer when it has no default and several brands', () => {
    const noDefault = {
      ...SILO_BRAND,
      values: SILO_BRAND.values.map((value) => ({
        ...value,
        defaultUnder: [],
      })),
    };

    expect(
      resolveDefaults({
        dimensions: [SILO, noDefault],
        selections: { silo: 'school', siloBrand: 'big' },
        changed: ['silo'],
      })
    ).toEqual({ silo: 'school' });
  });

  it('keeps a brand the user chose and the silo still offers', () => {
    expect(
      resolveDefaults({
        dimensions: both,
        selections: { silo: 'school', siloBrand: 'blue' },
        changed: ['silo'],
      })
    ).toEqual({ silo: 'school', siloBrand: 'blue' });
  });

  it("follows the template's own brand when it is offered under the silo", () => {
    expect(
      resolveDefaults({
        dimensions: both,
        selections: {},
        templateDefaults: { silo: 'youth', siloBrand: 'big_reader' },
      })
    ).toEqual({ silo: 'youth', siloBrand: 'big' });
  });

  it("ignores the template's own brand when the silo does not offer it", () => {
    expect(
      resolveDefaults({
        dimensions: both,
        selections: {},
        templateDefaults: { silo: 'school', siloBrand: 'little_reader' },
      })
    ).toEqual({ silo: 'school', siloBrand: 'red' });
  });

  it('applies no company default to a brand whose silo is out of the email scope', () => {
    // The server sends no silo: the brand is offered with all its values.
    expect(
      resolveDefaults({ dimensions: [SILO_BRAND], selections: {} })
    ).toEqual({});
  });
});

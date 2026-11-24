'use strict';

// Acceptance tests of adoption (epic #1515, ADR-0024): an email with no value for
// a dimension takes the value its content already holds, in the template
// property of the dimension's name, or in the source the template contract
// declares (`brand_[silo]`, where `[silo]` is the identifier of the email's silo).
// Parents are adopted before their children. What cannot be adopted is
// reported, never guessed.
//
// `content` holds the root properties of an email's content, as a template made
// before the taxonomy saved them.

const SILO = {
  name: 'silo',
  values: [
    { id: 'youth', canonicalType: 'youth', isActive: true },
    { id: 'school', canonicalType: 'school', isActive: true },
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
  ],
};

const DIMENSIONS = [SILO, SILO_BRAND];
const CONTRACT = { adopt: { siloBrand: 'brand_[silo]' } };

// Turned on by #1525 (an email adopts the values its content holds when it opens)
describe.skip('adoption when an email opens', () => {
  let adoptValues;
  let resolveDefaults;

  beforeAll(() => {
    // Required here: the modules don't exist until #1523 and #1525.
    ({
      adoptValues,
    } = require('../../../packages/shared/taxonomy/adoption.js'));
    ({
      resolveDefaults,
    } = require('../../../packages/shared/taxonomy/default-values.js'));
  });

  const adopt = (content, selections = {}) =>
    adoptValues({
      dimensions: DIMENSIONS,
      contract: CONTRACT,
      content,
      selections,
    });

  it('adopts a value from the property of the same name', () => {
    expect(adopt({ silo: 'youth' })).toMatchObject({
      selections: { silo: 'youth' },
      adopted: ['silo'],
      gaps: [],
    });
  });

  it('adopts a renamed property from the source the template declares, under the adopted parent', () => {
    expect(
      adopt({ silo: 'youth', brand_youth: 'little_reader' }).selections
    ).toEqual({ silo: 'youth', siloBrand: 'little' });
  });

  it('ignores what other silos left in the content', () => {
    // The email was on the youth silo, then moved to the school one: the old
    // template kept every brand_<silo> it ever filled.
    const content = {
      silo: 'school',
      brand_youth: 'little_reader',
      brand_school: 'blue_notebooks',
    };

    expect(adopt(content).selections).toEqual({
      silo: 'school',
      siloBrand: 'blue',
    });
  });

  it('reports an identifier no value carries, and adopts nothing under it', () => {
    expect(adopt({ silo: 'cookery', brand_cookery: 'chef' })).toEqual({
      selections: {},
      adopted: [],
      gaps: [
        {
          dimension: 'silo',
          identifier: 'cookery',
          reason: 'UNKNOWN_IDENTIFIER',
        },
      ],
    });
  });

  it('reports a brand the silo does not offer, and does not adopt it', () => {
    expect(adopt({ silo: 'school', brand_school: 'little_reader' })).toEqual({
      selections: { silo: 'school' },
      adopted: ['silo'],
      gaps: [
        {
          dimension: 'siloBrand',
          identifier: 'little_reader',
          reason: 'NOT_OFFERED',
        },
      ],
    });
  });

  it("lets the rest of the order apply after a gap: the silo's default brand", () => {
    const { selections, adopted } = adopt({
      silo: 'school',
      brand_school: 'little_reader',
    });

    expect(
      resolveDefaults({ dimensions: DIMENSIONS, selections, changed: adopted })
    ).toEqual({ silo: 'school', siloBrand: 'red' });
  });

  it('adopts nothing from a property the user emptied and saved', () => {
    expect(adopt({ silo: '', brand_youth: 'little_reader' })).toEqual({
      selections: {},
      adopted: [],
      gaps: [],
    });
  });

  it('never replaces a value the email carries, and reads the source under it', () => {
    const content = {
      silo: 'school',
      brand_youth: 'little_reader',
      brand_school: 'blue_notebooks',
    };

    expect(adopt(content, { silo: 'youth' })).toMatchObject({
      selections: { silo: 'youth', siloBrand: 'little' },
      adopted: ['siloBrand'],
    });
  });

  it('adopts nothing for a dimension already filled', () => {
    expect(
      adopt(
        { silo: 'school', brand_school: 'blue_notebooks' },
        {
          silo: 'school',
          siloBrand: 'red',
        }
      )
    ).toEqual({
      selections: { silo: 'school', siloBrand: 'red' },
      adopted: [],
      gaps: [],
    });
  });
});

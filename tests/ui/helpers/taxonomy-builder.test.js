'use strict';

// Acceptance tests of the taxonomy screen's logic (epic #1351).
//
// The screen's components stay thin; what it decides (the order dimensions are
// listed in, what each one allows, what a dimension may hang under) lives in pure
// helpers, tested here, the way the rest of packages/ui is tested.

const EMAIL_TYPE = {
  name: 'emailType',
  label: 'Typologie',
  standard: true,
  isActive: true,
  order: 50,
  precedence: 40,
};
const TRIGGER = {
  name: 'trigger',
  label: 'Déclenchement',
  standard: true,
  isActive: true,
  order: 60,
  precedence: 0,
};
const MARKET = {
  name: 'market',
  label: 'Marché',
  standard: false,
  isActive: true,
  order: 10,
  precedence: 20,
};
const LANGUAGE = {
  name: 'language',
  label: 'Langue',
  standard: false,
  isActive: true,
  order: 20,
  precedence: 30,
  parentName: 'market',
};
const BRAND = {
  name: 'brand',
  label: 'Marque',
  standard: false,
  isActive: true,
  order: 5,
  precedence: 10,
};

const HELPERS = '../../../packages/ui/helpers/taxonomy-builder.js';

// Turned on by #1353 (dimensions are records; the email type and the trigger as
// standard dimensions)
describe.skip('taxonomy screen: standard dimensions', () => {
  let sortDimensions;
  let dimensionActions;

  beforeAll(() => {
    // Required here, not at the top of the file: the module doesn't exist until
    // #1353 ships it.
    ({ sortDimensions, dimensionActions } = require(HELPERS));
  });

  it('lists the email type and the trigger first, whatever their order', () => {
    expect(
      sortDimensions([MARKET, TRIGGER, BRAND, EMAIL_TYPE]).map((d) => d.name)
    ).toEqual(['emailType', 'trigger', 'brand', 'market']);
  });

  it('locks a standard dimension: no rename, no deactivation, no deletion', () => {
    expect(dimensionActions(EMAIL_TYPE, { valueCount: 0 })).toMatchObject({
      canRename: false,
      canDeactivate: false,
      canDelete: false,
      canEditValues: true,
    });
  });

  it('shows the trigger values without letting anyone edit them', () => {
    expect(dimensionActions(TRIGGER, { valueCount: 0 })).toMatchObject({
      canDeactivate: false,
      canDelete: false,
      canEditValues: false,
    });
  });
});

// Turned on by #1354 (declare a company dimension and its values)
describe.skip('taxonomy screen: company dimensions', () => {
  let sortDimensions;
  let dimensionActions;
  let isValidDimensionName;
  let proposeIdentifier;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1353.
    ({
      sortDimensions,
      dimensionActions,
      isValidDimensionName,
      proposeIdentifier,
    } = require(HELPERS));
  });

  it('lists company dimensions in their declared order, then by label', () => {
    const audience = { ...MARKET, name: 'audience', label: 'Cible' };

    expect(
      sortDimensions([MARKET, audience, BRAND]).map((d) => d.name)
    ).toEqual(['brand', 'audience', 'market']);
  });

  it.each(['audience', 'emailType2', '_internal', 'Brand'])(
    'accepts %p as a name a template can read',
    (name) => {
      expect(isValidDimensionName(name)).toBe(true);
    }
  );

  it.each(['my-audience', '2audience', 'audience name', 'cible€', '', null])(
    'refuses %p before the server does',
    (name) => {
      expect(isValidDimensionName(name)).toBe(false);
    }
  );

  it.each([
    ['Canada', 'canada'],
    ['Clients fidèles', 'clients-fideles'],
    ['  Français (Belgique) ', 'francais-belgique'],
    ['Black Friday 2026', 'black-friday-2026'],
    ['!!!', ''],
  ])('proposes the identifier of %p as %p', (label, identifier) => {
    expect(proposeIdentifier(label)).toBe(identifier);
  });

  it('never lets a name be renamed, and deletes only an empty dimension', () => {
    expect(dimensionActions(MARKET, { valueCount: 0 })).toMatchObject({
      canRename: false,
      canDeactivate: true,
      canDelete: true,
      canEditValues: true,
    });
    expect(dimensionActions(MARKET, { valueCount: 3 })).toMatchObject({
      canDelete: false,
    });
  });
});

// Turned on by #1358 (nested dimensions and availability)
describe.skip('taxonomy screen: nesting', () => {
  let parentCandidates;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1353.
    ({ parentCandidates } = require(HELPERS));
  });

  const ALL = [EMAIL_TYPE, TRIGGER, MARKET, LANGUAGE, BRAND];

  it('offers the email type and every other active dimension as a parent', () => {
    expect(parentCandidates(ALL, BRAND).sort()).toEqual(
      ['emailType', 'language', 'market'].sort()
    );
  });

  it('never offers the trigger, the dimension itself, or one of its descendants', () => {
    const candidates = parentCandidates(ALL, MARKET);

    expect(candidates).not.toContain('trigger');
    expect(candidates).not.toContain('market');
    // Market under language would be a cycle: language already hangs under it.
    expect(candidates).not.toContain('language');
  });

  it('never offers a deactivated dimension', () => {
    expect(
      parentCandidates(
        [...ALL, { ...MARKET, name: 'old', isActive: false }],
        BRAND
      )
    ).not.toContain('old');
  });
});

// Turned on by #1359 (design tokens and precedence)
describe.skip('taxonomy screen: precedence', () => {
  let resolutionOrder;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1353.
    ({ resolutionOrder } = require(HELPERS));
  });

  it('shows the resolution order, the last one winning', () => {
    expect(
      resolutionOrder([EMAIL_TYPE, TRIGGER, MARKET, LANGUAGE, BRAND])
    ).toEqual(['brand', 'market', 'language', 'emailType']);
  });

  it('breaks a tie by the declared order, like the editor does', () => {
    expect(
      resolutionOrder([
        { ...MARKET, precedence: 10 },
        { ...BRAND, precedence: 10 },
      ])
    ).toEqual(['brand', 'market']);
  });

  it('leaves deactivated dimensions out', () => {
    expect(resolutionOrder([BRAND, { ...MARKET, isActive: false }])).toEqual([
      'brand',
    ]);
  });
});

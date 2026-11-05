'use strict';

// Acceptance tests of the company dimension selects of the email settings (epic
// #1351).
//
// `dimensions` is what the server sends the editor: the active company
// dimensions in their declared order, each with its values. `selections` maps a
// dimension name to the id of the value the email carries.

const MARKET = {
  name: 'market',
  label: 'Marché',
  values: [
    { id: 'ca', label: 'Canada', isActive: true },
    { id: 'be', label: 'Belgique', isActive: true },
    { id: 'de', label: 'Allemagne', isActive: true },
  ],
};

// Declared BEFORE its parent on purpose: a child is shown right after its
// parent, whatever the declared order.
const LANGUAGE = {
  name: 'language',
  label: 'Langue',
  parentName: 'market',
  values: [
    { id: 'fr', label: 'Français', isActive: true, parentIds: ['ca', 'be'] },
    { id: 'nl', label: 'Néerlandais', isActive: true, parentIds: ['be'] },
    // No availability: offered under every market.
    { id: 'en', label: 'Anglais', isActive: true, parentIds: [] },
  ],
};

const AUDIENCE = {
  name: 'audience',
  label: 'Cible',
  values: [
    { id: 'vip', label: 'Clients VIP', isActive: true },
    { id: 'old', label: 'Anciens clients', isActive: false },
  ],
};

const labels = (select) => select.options.map((option) => option.label);

// Turned on by #1355 (choose the values of company dimensions on an email)
describe.skip('selects of company dimensions', () => {
  let dimensionSelects;

  beforeAll(() => {
    // Required here, not at the top of the file: the module doesn't exist until
    // #1355 ships it.
    ({
      dimensionSelects,
    } = require('../../packages/editor/src/js/utils/dimension-selects.js'));
  });

  it('gives one select per dimension, in the declared order', () => {
    const selects = dimensionSelects({
      dimensions: [AUDIENCE, MARKET],
      selections: {},
    });

    expect(selects.map((select) => select.name)).toEqual([
      'audience',
      'market',
    ]);
    expect(selects[1]).toMatchObject({ label: 'Marché', value: null });
    expect(labels(selects[1])).toEqual(['Canada', 'Belgique', 'Allemagne']);
  });

  it('shows the value the email carries', () => {
    const [audience] = dimensionSelects({
      dimensions: [AUDIENCE],
      selections: { audience: 'vip' },
    });

    expect(audience.value).toBe('vip');
  });

  it('offers a deactivated value only to the email that carries it', () => {
    const [carrying] = dimensionSelects({
      dimensions: [AUDIENCE],
      selections: { audience: 'old' },
    });
    const [other] = dimensionSelects({
      dimensions: [AUDIENCE],
      selections: {},
    });

    expect(labels(carrying)).toEqual(['Clients VIP', 'Anciens clients']);
    expect(carrying.value).toBe('old');
    expect(labels(other)).toEqual(['Clients VIP']);
  });
});

// Turned on by #1358 (nested dimensions and availability)
describe.skip('nested selects', () => {
  let dimensionSelects;
  let reconcileSelections;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1355.
    ({
      dimensionSelects,
      reconcileSelections,
    } = require('../../packages/editor/src/js/utils/dimension-selects.js'));
  });

  const PROGRAMME = {
    name: 'programme',
    label: 'Programme',
    parentName: 'emailType',
    values: [
      {
        id: 'loyalty',
        label: 'Fidélité',
        isActive: true,
        parentIds: ['promo'],
      },
    ],
  };

  it('puts a child right after its parent, whatever the declared order', () => {
    const selects = dimensionSelects({
      dimensions: [LANGUAGE, AUDIENCE, MARKET],
      selections: { market: 'ca' },
    });

    expect(selects.map((select) => select.name)).toEqual([
      'audience',
      'market',
      'language',
    ]);
  });

  it('hides the child while its parent has no value', () => {
    const selects = dimensionSelects({
      dimensions: [MARKET, LANGUAGE],
      selections: {},
    });

    expect(selects.map((select) => select.name)).toEqual(['market']);
  });

  it('offers only the values available under the parent value, and those offered everywhere', () => {
    const language = (market) =>
      dimensionSelects({
        dimensions: [MARKET, LANGUAGE],
        selections: { market },
      }).find((select) => select.name === 'language');

    expect(labels(language('ca'))).toEqual(['Français', 'Anglais']);
    expect(labels(language('be'))).toEqual([
      'Français',
      'Néerlandais',
      'Anglais',
    ]);
    expect(labels(language('de'))).toEqual(['Anglais']);
  });

  it('keeps showing a value no longer offered under the parent value, and says so', () => {
    // An admin narrowed Dutch to Belgium after this email chose Canada + Dutch.
    const language = dimensionSelects({
      dimensions: [MARKET, LANGUAGE],
      selections: { market: 'ca', language: 'nl' },
    }).find((select) => select.name === 'language');

    expect(language).toMatchObject({ value: 'nl', unavailable: true });
    expect(labels(language)).toContain('Néerlandais');
  });

  it('offers a dimension under the email type by the email type chosen', () => {
    const without = dimensionSelects({
      dimensions: [PROGRAMME],
      selections: {},
    });
    const promo = dimensionSelects({
      dimensions: [PROGRAMME],
      selections: {},
      emailTypeId: 'promo',
    });
    const editorial = dimensionSelects({
      dimensions: [PROGRAMME],
      selections: {},
      emailTypeId: 'editorial',
    });

    expect(without).toEqual([]);
    expect(labels(promo[0])).toEqual(['Fidélité']);
    expect(labels(editorial[0])).toEqual([]);
  });

  describe('when the user changes a parent value', () => {
    it('keeps a child value still offered: Belgium + French, then Canada', () => {
      expect(
        reconcileSelections({
          dimensions: [MARKET, LANGUAGE],
          selections: { market: 'ca', language: 'fr' },
        })
      ).toEqual({ market: 'ca', language: 'fr' });
    });

    it('clears a child value no longer offered: Belgium + Dutch, then Canada', () => {
      expect(
        reconcileSelections({
          dimensions: [MARKET, LANGUAGE],
          selections: { market: 'ca', language: 'nl' },
        })
      ).toEqual({ market: 'ca' });
    });

    it('clears the child of a child it cleared', () => {
      const SCRIPT = {
        name: 'script',
        label: 'Écriture',
        parentName: 'language',
        values: [
          { id: 'latin', label: 'Latin', isActive: true, parentIds: ['nl'] },
        ],
      };

      expect(
        reconcileSelections({
          dimensions: [MARKET, LANGUAGE, SCRIPT],
          selections: { market: 'ca', language: 'nl', script: 'latin' },
        })
      ).toEqual({ market: 'ca' });
    });

    it('clears a child when its parent is emptied', () => {
      expect(
        reconcileSelections({
          dimensions: [MARKET, LANGUAGE],
          selections: { language: 'en' },
        })
      ).toEqual({});
    });

    it('follows a change of email type', () => {
      expect(
        reconcileSelections({
          dimensions: [PROGRAMME],
          selections: { programme: 'loyalty' },
          emailTypeId: 'editorial',
        })
      ).toEqual({});
    });
  });
});

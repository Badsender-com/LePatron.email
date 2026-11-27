import {
  valueFormFor,
  valuePayloadFrom,
} from '~/helpers/taxonomy-value-form.js';

// What the value panel sends (ADR-0026): what a value is. Its availability and
// its defaults are set in the crossings matrix and the Defaults segment, its
// order by drag and drop: the panel never sends them, so it never undoes them.

const YOUTH = '507f1f77bcf86cd799439a01';
const stored = {
  label: 'Petit Lecteur',
  isDefault: true,
  _parents: [YOUTH],
  defaultUnder: [YOUTH],
  order: 30,
  tokens: { mainColorVar: '#ffd845' },
};

describe('the body the value panel sends', () => {
  it('never carries the availability, the defaults or the order of a value edited', () => {
    const payload = valuePayloadFrom(valueFormFor(stored), {
      role: null,
      isNew: false,
    });

    expect(payload).toEqual({
      label: 'Petit Lecteur',
      description: null,
      canonicalType: null,
      isActive: true,
      tokens: { mainColorVar: '#ffd845' },
    });
  });

  it('gives a new value its place at the end of the list', () => {
    const form = { ...valueFormFor(null, 40), label: ' Guide ' };

    expect(valuePayloadFrom(form, { role: null, isNew: true })).toMatchObject({
      label: 'Guide',
      order: 40,
    });
  });

  it('carries the code when the dimension has a role', () => {
    const form = { ...valueFormFor(null), label: 'Belgique', code: 'BE' };

    expect(valuePayloadFrom(form, { role: 'country', isNew: true }).code).toBe(
      'BE'
    );
    expect(
      valuePayloadFrom(form, { role: null, isNew: true })
    ).not.toHaveProperty('code');
  });
});

// An email type's doctrine type (ADR-0030) travels only when the admin changed
// it: a value the migration has not reached yet has none at all, and saving its
// label must not record it as mapped onto none.
describe('the doctrine type the value panel sends', () => {
  const send = (item, change = {}) =>
    valuePayloadFrom(
      { ...valueFormFor(item), ...change },
      {
        role: null,
        isNew: !item,
        isEmailType: true,
        initialDoctrineType: item ? item.doctrineType : undefined,
      }
    );

  it('sends the doctrine type of a new email type, none included', () => {
    expect(send(null, { label: 'Enquête' }).doctrineType).toBeNull();
    expect(
      send(null, { label: 'Promo', doctrineType: 'promotional' }).doctrineType
    ).toBe('promotional');
  });

  it('leaves out the doctrine type of an email type the migration has not reached', () => {
    const payload = send(
      { label: 'Infolettre', canonicalType: 'editorial' },
      { label: 'Infolettre mensuelle' }
    );

    expect(payload).not.toHaveProperty('doctrineType');
  });

  it('sends a doctrine type the admin changed or cleared', () => {
    const mapped = { label: 'Infolettre', doctrineType: 'editorial' };

    expect(send(mapped, { doctrineType: 'promotional' }).doctrineType).toBe(
      'promotional'
    );
    expect(send(mapped, { doctrineType: null }).doctrineType).toBeNull();
    expect(send(mapped)).not.toHaveProperty('doctrineType');
  });
});

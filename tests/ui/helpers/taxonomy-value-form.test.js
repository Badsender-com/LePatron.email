import {
  valueFormFor,
  valuePayloadFrom,
  canBeDefault,
} from '~/helpers/taxonomy-value-form.js';

// What the value dialog sends for each kind of dimension (ADR-0024): a ticked
// default at the first level (#1523), the parent values a child value is the
// default under (#1524), nothing on the email type.

const AUDIENCE = { isEmailType: false, hasParent: false, role: null };
const BRAND = { isEmailType: false, hasParent: true, role: null };
const EMAIL_TYPE = { isEmailType: true, hasParent: false, role: null };

describe('the default of a value in the value dialog', () => {
  it('is offered on every dimension but the email type', () => {
    expect(canBeDefault(AUDIENCE)).toBe(true);
    expect(canBeDefault(BRAND)).toBe(true);
    expect(canBeDefault(EMAIL_TYPE)).toBe(false);
  });

  it('starts unticked for a new value, and as stored for an existing one', () => {
    expect(valueFormFor(null).isDefault).toBe(false);
    expect(
      valueFormFor({ label: 'Enseignants', isDefault: true }).isDefault
    ).toBe(true);
  });

  it('is sent for a first-level dimension, ticked or not', () => {
    const form = valueFormFor({ label: 'Enseignants', isDefault: true });
    expect(valuePayloadFrom(form, AUDIENCE).isDefault).toBe(true);
    expect(
      valuePayloadFrom({ ...form, isDefault: false }, AUDIENCE).isDefault
    ).toBe(false);
  });

  it('is never ticked for a child dimension, nor for the email type', () => {
    const form = valueFormFor({ label: 'Petit Lecteur', isDefault: true });
    expect(valuePayloadFrom(form, BRAND)).not.toHaveProperty('isDefault');
    expect(valuePayloadFrom(form, EMAIL_TYPE)).not.toHaveProperty('isDefault');
    expect(valuePayloadFrom(form, EMAIL_TYPE)).not.toHaveProperty(
      'defaultUnder'
    );
  });
});

describe('the parent values a child value is the default under', () => {
  const YOUTH = '507f1f77bcf86cd799439a01';
  const SCHOOL = '507f1f77bcf86cd799439a02';

  it('starts empty, and as stored for an existing value', () => {
    expect(valueFormFor(null).defaultUnder).toEqual([]);
    expect(
      valueFormFor({ label: 'Petit Lecteur', defaultUnder: [YOUTH] })
        .defaultUnder
    ).toEqual([YOUTH]);
  });

  it('is sent for a child dimension, never for a first-level one', () => {
    const form = {
      ...valueFormFor(null),
      label: 'Guide',
      defaultUnder: [YOUTH],
    };
    expect(valuePayloadFrom(form, BRAND).defaultUnder).toEqual([YOUTH]);
    expect(valuePayloadFrom(form, AUDIENCE)).not.toHaveProperty('defaultUnder');
  });

  it('keeps only the parent values the availability offers it under', () => {
    const form = {
      ...valueFormFor(null),
      label: 'Guide',
      parentIds: [SCHOOL],
      defaultUnder: [YOUTH, SCHOOL],
    };
    expect(valuePayloadFrom(form, BRAND).defaultUnder).toEqual([SCHOOL]);
  });
});

describe('the rest of the body the value dialog sends', () => {
  it('carries the availability under a parent, and the code with a role', () => {
    const form = {
      ...valueFormFor(null, 3),
      label: ' Belgique ',
      parentIds: ['507f1f77bcf86cd799439a01'],
      code: 'BE',
    };

    expect(valuePayloadFrom(form, BRAND)).toMatchObject({
      label: 'Belgique',
      order: 3,
      parentIds: ['507f1f77bcf86cd799439a01'],
      tokens: {},
    });
    expect(valuePayloadFrom(form, { ...AUDIENCE, role: 'country' }).code).toBe(
      'BE'
    );
    expect(valuePayloadFrom(form, AUDIENCE)).not.toHaveProperty('code');
  });
});

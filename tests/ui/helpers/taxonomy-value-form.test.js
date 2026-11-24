import {
  valueFormFor,
  valuePayloadFrom,
  canBeDefault,
} from '~/helpers/taxonomy-value-form.js';

// What the value dialog sends for each kind of dimension (#1523, ADR-0024): the
// company's default is a first-level dimension's only.

const AUDIENCE = { isEmailType: false, hasParent: false, role: null };
const BRAND = { isEmailType: false, hasParent: true, role: null };
const EMAIL_TYPE = { isEmailType: true, hasParent: false, role: null };

describe('the default of a value in the value dialog', () => {
  it('is offered on a first-level dimension only', () => {
    expect(canBeDefault(AUDIENCE)).toBe(true);
    expect(canBeDefault(BRAND)).toBe(false);
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

  it('is never sent for a child dimension, nor for the email type', () => {
    const form = valueFormFor({ label: 'Petit Lecteur', isDefault: true });
    expect(valuePayloadFrom(form, BRAND)).not.toHaveProperty('isDefault');
    expect(valuePayloadFrom(form, EMAIL_TYPE)).not.toHaveProperty('isDefault');
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

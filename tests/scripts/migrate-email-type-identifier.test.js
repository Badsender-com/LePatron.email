'use strict';

// The migration of the email types already in production (epic #1631,
// ADR-0030). Their one field held the doctrine type; it moves to a field of its
// own, and each email type is left with a unique identifier. Planned by a pure
// function, so what the dry run reports is what the run writes.

const COMPANY_A = 'company-a';
const COMPANY_B = 'company-b';

const emailType = (id, company, label, extra = {}) => ({
  _id: id,
  _company: company,
  type: 'emailType',
  label,
  ...extra,
});

const PRODUCTION = [
  // Company A declined "editorial" into two email types of its own.
  emailType('a1', COMPANY_A, 'Infolettre communauté', {
    canonicalType: 'editorial',
  }),
  emailType('a2', COMPANY_A, 'Relationnel', { canonicalType: 'editorial' }),
  emailType('a3', COMPANY_A, 'Promotionnel', { canonicalType: 'promotional' }),
  // Mapped onto nothing.
  emailType('a4', COMPANY_A, 'Enquête'),
  // Company B kept the defaults, one per doctrine type.
  emailType('b1', COMPANY_B, 'Éditorial', { canonicalType: 'editorial' }),
  emailType('b2', COMPANY_B, 'Transactionnel', {
    canonicalType: 'transactional',
  }),
];

const byId = (updates) =>
  Object.fromEntries(updates.map((update) => [update.id, update.set]));

const migrate = (emailTypes, plan) =>
  emailTypes.map((item) => ({
    ...item,
    ...(byId(plan.updates)[item._id] || {}),
  }));

// Turned on by #1633 (the doctrine type of an email type is a field of its own)
describe('migrate email types: doctrine type', () => {
  let planEmailTypeMigration;

  beforeAll(() => {
    // Required here, not at the top of the file: the script doesn't exist
    // until #1633 ships it.
    ({
      planEmailTypeMigration,
    } = require('../../scripts/migrate-email-type-identifier'));
  });

  it('copies the mapping of each email type into its doctrine type', () => {
    const plan = planEmailTypeMigration({ emailTypes: PRODUCTION });
    const after = migrate(PRODUCTION, plan);

    expect(
      Object.fromEntries(after.map((item) => [item._id, item.doctrineType]))
    ).toEqual({
      a1: 'editorial',
      a2: 'editorial',
      a3: 'promotional',
      a4: null,
      b1: 'editorial',
      b2: 'transactional',
    });
  });

  it('maps onto nothing an email type whose old value is not one of the doctrine', () => {
    const plan = planEmailTypeMigration({
      emailTypes: [
        emailType('c1', 'company-c', 'Newsletter', {
          canonicalType: 'newsletter',
        }),
      ],
    });

    expect(byId(plan.updates).c1.doctrineType).toBeNull();
  });

  it('changes nothing on a second run', () => {
    const first = planEmailTypeMigration({ emailTypes: PRODUCTION });
    const second = planEmailTypeMigration({
      emailTypes: migrate(PRODUCTION, first),
    });

    expect(second.updates).toEqual([]);
  });

  it('never maps again an email type an admin has since left unmapped', () => {
    const plan = planEmailTypeMigration({
      emailTypes: [
        emailType('d1', 'company-d', 'Éditorial', {
          canonicalType: 'editorial',
          doctrineType: null,
        }),
      ],
    });

    expect(plan.updates).toEqual([]);
  });

  it('reports a company dimension already named doctrineType, without renaming it', () => {
    const plan = planEmailTypeMigration({
      emailTypes: PRODUCTION,
      dimensions: [
        { _company: COMPANY_B, name: 'doctrineType' },
        { _company: COMPANY_A, name: 'market' },
      ],
    });

    expect(plan.reservedNameTaken).toEqual([COMPANY_B]);
  });
});

// Turned on by #1638 (an email type has a free identifier, like any value)
describe('migrate email types: identifier', () => {
  let planEmailTypeMigration;

  beforeAll(() => {
    ({
      planEmailTypeMigration,
    } = require('../../scripts/migrate-email-type-identifier'));
  });

  const identifiers = (emailTypes) =>
    Object.fromEntries(
      emailTypes.map((item) => [item._id, item.canonicalType])
    );

  it('keeps the doctrine type as identifier where it is unique, and proposes one from the label elsewhere', () => {
    const after = migrate(
      PRODUCTION,
      planEmailTypeMigration({ emailTypes: PRODUCTION })
    );

    expect(identifiers(after)).toEqual({
      a1: 'infolettre_communaute',
      a2: 'relationnel',
      a3: 'promotional',
      a4: undefined,
      b1: 'editorial',
      b2: 'transactional',
    });
  });

  it('suffixes a proposed identifier already taken in the company', () => {
    const emailTypes = [
      emailType('e1', 'company-e', 'Promo', { canonicalType: 'promotional' }),
      emailType('e2', 'company-e', 'Promo !', { canonicalType: 'promotional' }),
    ];

    const after = migrate(emailTypes, planEmailTypeMigration({ emailTypes }));

    expect(identifiers(after)).toEqual({ e1: 'promo', e2: 'promo_2' });
  });

  it('gives every email type of a company a different identifier, and changes nothing on a second run', () => {
    const first = migrate(
      PRODUCTION,
      planEmailTypeMigration({ emailTypes: PRODUCTION })
    );
    const ofA = first
      .filter((item) => item._company === COMPANY_A && item.canonicalType)
      .map((item) => item.canonicalType);

    expect(new Set(ofA).size).toBe(ofA.length);
    expect(planEmailTypeMigration({ emailTypes: first }).updates).toEqual([]);
  });
});

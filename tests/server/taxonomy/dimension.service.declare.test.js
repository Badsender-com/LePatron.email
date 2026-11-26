'use strict';

// Acceptance tests of the dimensions (epic #1351, ADR-0032 and ADR-0015).
//
// A dimension is an axis a company declines its emails by. Two are standard, the
// email type and the email trigger; every other one is declared by the company.
// The collections are in-memory fakes that interpret queries like MongoDB, so
// these tests hold the service to its answers, not to the shape of its queries.
//
// A malformed request is a 400, as everywhere else in the taxonomy module; a
// request that is well formed but contradicts what is stored is a 409.

jest.mock('../../../packages/server/common/models.common.js', () =>
  require('../../helpers/taxonomy-world.js').fakeTaxonomyModels()
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const models = require('../../../packages/server/common/models.common.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const {
  adminA,
  techAdminA,
  adminB,
  idOf,
  resetTaxonomyModels,
} = require('../../helpers/taxonomy-world.js');

const DIMENSION_SERVICE =
  '../../../packages/server/taxonomy/services/dimension.service.js';

beforeEach(() => resetTaxonomyModels(models));

// Turned on by #1354 (declare a company dimension and its values)
describe('declaring a company dimension', () => {
  let dimensionService;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1353.
    dimensionService = require(DIMENSION_SERVICE);
  });

  it('declares a dimension of the company, next to the standard ones', async () => {
    const created = await dimensionService.createDimension({
      user: adminA,
      payload: {
        name: 'audience',
        label: 'Cible',
        description: 'À qui l’email s’adresse.',
      },
    });

    expect(created).toMatchObject({
      name: 'audience',
      label: 'Cible',
      standard: false,
      isActive: true,
    });
    const listed = await dimensionService.listDimensions({ user: adminA });
    expect(listed.map((dimension) => dimension.name).sort()).toEqual([
      'audience',
      'emailType',
      'trigger',
    ]);
  });

  it('lets a tech admin declare one too', async () => {
    await expect(
      dimensionService.createDimension({
        user: techAdminA,
        payload: { name: 'brand', label: 'Marque' },
      })
    ).resolves.toMatchObject({ name: 'brand' });
  });

  it.each(['my-audience', '2audience', 'audience name', 'cible€', ''])(
    'refuses %p, which no template could read',
    async (name) => {
      await expect(
        dimensionService.createDimension({
          user: adminA,
          payload: { name, label: 'Cible' },
        })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.INVALID_DIMENSION,
      });
    }
  );

  it.each(['__proto__', 'constructor', 'prototype'])(
    'refuses %p, which the values of an email could not be stored under',
    async (name) => {
      await expect(
        dimensionService.createDimension({
          user: adminA,
          payload: { name, label: 'Réservé' },
        })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.DIMENSION_NAME_RESERVED,
      });
    }
  );

  // A dimension may fill in a template option (#1532).
  it.each(['country', 'bodyWidth'])(
    'accepts %p, the name of a template option',
    async (name) => {
      await expect(
        dimensionService.createDimension({
          user: adminA,
          payload: { name, label: 'Option' },
        })
      ).resolves.toMatchObject({ name });
    }
  );

  it('refuses a name past its bound with a 400 naming it, not a 500', async () => {
    const {
      TaxonomyLimits,
    } = require('../../../packages/server/constant/taxonomy-type.js');

    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: {
          name: 'a'.repeat(TaxonomyLimits.DIMENSION_NAME + 1),
          label: 'Trop long',
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.DIMENSION_NAME_TOO_LONG,
      details: { limit: TaxonomyLimits.DIMENSION_NAME },
    });
    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: {
          name: 'a'.repeat(TaxonomyLimits.DIMENSION_NAME),
          label: 'Juste assez',
        },
      })
    ).resolves.toMatchObject({ label: 'Juste assez' });
  });

  it('refuses a dimension without a label', async () => {
    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: { name: 'audience' },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.INVALID_DIMENSION,
    });
  });

  it.each(['audience', 'trigger'])(
    'refuses a second dimension named %s',
    async (name) => {
      await dimensionService.createDimension({
        user: adminA,
        payload: { name: 'audience', label: 'Cible' },
      });

      await expect(
        dimensionService.createDimension({
          user: adminA,
          payload: { name, label: 'Doublon' },
        })
      ).rejects.toMatchObject({
        status: 409,
        message: ERROR_CODES.DIMENSION_NAME_ALREADY_EXISTS,
      });
    }
  );

  // `market` and `Market` are two properties for a template, and two lists of
  // the same values in the editor: almost always a typo, never correctable
  // later since the name is final.
  describe('a name that differs from an existing one only by its case', () => {
    it.each([
      ['market', 'Market'],
      ['trigger', 'Trigger'],
    ])(
      'refuses %s next to %s until the admin confirms it',
      async (existingName, name) => {
        if (existingName !== 'trigger') {
          await dimensionService.createDimension({
            user: adminA,
            payload: { name: existingName, label: 'Marché' },
          });
        }

        await expect(
          dimensionService.createDimension({
            user: adminA,
            payload: { name, label: 'Marché bis' },
          })
        ).rejects.toMatchObject({
          status: 409,
          message: ERROR_CODES.DIMENSION_NAME_DIFFERS_ONLY_BY_CASE,
          details: { existingName },
        });
        expect(
          models.TaxonomyDimensions.all().filter((d) => d.name === name)
        ).toHaveLength(0);
      }
    );

    it('declares it once the admin confirms', async () => {
      await dimensionService.createDimension({
        user: adminA,
        payload: { name: 'market', label: 'Marché' },
      });

      await expect(
        dimensionService.createDimension({
          user: adminA,
          payload: {
            name: 'Market',
            label: 'Marché bis',
            confirmCaseVariant: true,
          },
        })
      ).resolves.toMatchObject({ name: 'Market', label: 'Marché bis' });
    });

    it('still refuses the exact same name, confirmed or not', async () => {
      await dimensionService.createDimension({
        user: adminA,
        payload: { name: 'market', label: 'Marché' },
      });

      await expect(
        dimensionService.createDimension({
          user: adminA,
          payload: {
            name: 'market',
            label: 'Marché',
            confirmCaseVariant: true,
          },
        })
      ).rejects.toMatchObject({
        status: 409,
        message: ERROR_CODES.DIMENSION_NAME_ALREADY_EXISTS,
      });
    });

    it('compares within the company only', async () => {
      await dimensionService.createDimension({
        user: adminB,
        payload: { name: 'market', label: 'Market' },
      });

      await expect(
        dimensionService.createDimension({
          user: adminA,
          payload: { name: 'Market', label: 'Marché' },
        })
      ).resolves.toMatchObject({ name: 'Market' });
    });

    it('refuses a confirmation that is not a boolean', async () => {
      await expect(
        dimensionService.createDimension({
          user: adminA,
          payload: {
            name: 'market',
            label: 'Marché',
            confirmCaseVariant: 'yes',
          },
        })
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.INVALID_DIMENSION,
      });
    });
  });

  it('refuses the name of a deactivated dimension as well', async () => {
    const audience = await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'audience', label: 'Cible' },
    });
    await dimensionService.updateDimension({
      user: adminA,
      dimensionId: idOf(audience),
      payload: { isActive: false },
    });

    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: { name: 'audience', label: 'Cible' },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.DIMENSION_NAME_ALREADY_EXISTS,
    });
  });

  it('lets two companies declare the same name', async () => {
    await dimensionService.createDimension({
      user: adminA,
      payload: { name: 'audience', label: 'Cible' },
    });

    await expect(
      dimensionService.createDimension({
        user: adminB,
        payload: { name: 'audience', label: 'Audience' },
      })
    ).resolves.toMatchObject({ name: 'audience' });
  });

  it('refuses the 21st dimension of a company, naming the limit', async () => {
    // The two standard dimensions count: 2 + 18 = 20.
    await dimensionService.listDimensions({ user: adminA });
    for (let i = 1; i <= 18; i += 1) {
      await dimensionService.createDimension({
        user: adminA,
        payload: { name: `axis${i}`, label: `Axe ${i}` },
      });
    }

    await expect(
      dimensionService.createDimension({
        user: adminA,
        payload: { name: 'oneTooMany', label: 'De trop' },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.TAXONOMY_LIMIT_REACHED,
      details: { limit: 20 },
    });
  });
});

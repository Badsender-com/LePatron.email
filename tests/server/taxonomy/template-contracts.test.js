'use strict';

// The company's templates with their contract, read by the taxonomy workspace
// (#1556): the preview of what an email proposes, and the templates reading a
// dimension. Scoped to the company.

jest.mock('../../../packages/server/common/models.common.js', () =>
  require('../../helpers/taxonomy-world.js').fakeTaxonomyModels()
);

const models = require('../../../packages/server/common/models.common.js');
const {
  COMPANY_A,
  COMPANY_B,
  techAdminA,
} = require('../../helpers/taxonomy-world.js');
const {
  listTemplateContracts,
} = require('../../../packages/server/taxonomy/services/template-contracts.service.js');
const {
  GUARD_GROUP_ADMIN,
} = require('../../../packages/server/account/auth.guard.js');
const {
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
} = require('../../../packages/server/group/group.guard.js');
const { routeInspector } = require('../../helpers/express-router.js');

beforeEach(() => {
  models.Templates.reset();
  models.Templates.seed([
    {
      _id: '507f1f77bcf86cd799439f02',
      _company: COMPANY_A,
      name: 'Transactional',
      markup: '<p data-ko-display="_root_.market eq \'be\'">Belgique</p>',
    },
    {
      _id: '507f1f77bcf86cd799439f01',
      _company: COMPANY_A,
      name: 'Newsletter',
      markup: '<td style="-ko-color: @[_root_.mainColorVar]"></td>',
    },
    {
      _id: '507f1f77bcf86cd799439f03',
      _company: COMPANY_B,
      name: 'Elsewhere',
      markup: '<p>Plain</p>',
    },
  ]);
});

describe("the company's templates with their contract", () => {
  it('lists its own templates by name, each with its contract', async () => {
    expect(await listTemplateContracts({ user: techAdminA })).toEqual([
      {
        id: '507f1f77bcf86cd799439f01',
        name: 'Newsletter',
        contract: {
          declared: {},
          read: ['mainColorVar'],
          adopt: {},
          compared: [],
        },
      },
      {
        id: '507f1f77bcf86cd799439f02',
        name: 'Transactional',
        contract: {
          declared: {},
          read: ['market'],
          adopt: {},
          compared: [{ property: 'market', literal: 'be', count: 1 }],
        },
      },
    ]);
  });

  it('is read by the company admins and the tech admins, in the company named', () => {
    const router = require('../../../packages/server/taxonomy/dimension.routes.js');

    expect(routeInspector(router).guardsOf('get', '/templates')).toEqual([
      GUARD_GROUP_ADMIN,
      GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
    ]);
  });
});

// Review of #1547: one query for the list, and only a contract stored by an
// older reader is read from the markup again.
describe('the contracts read in one query', () => {
  const {
    CONTRACT_READER_VERSION,
  } = require('../../../packages/server/template/template-contract.js');
  const stored = {
    declared: {},
    read: ['stored'],
    adopt: {},
    compared: [],
  };

  beforeEach(() => {
    models.Templates.reset();
    models.Templates.seed([
      {
        _id: '507f1f77bcf86cd799439f01',
        _company: COMPANY_A,
        name: 'Current',
        markup: '<p data-ko-display="_root_.market eq \'be\'">B</p>',
        contract: stored,
        contractVersion: CONTRACT_READER_VERSION,
      },
      {
        _id: '507f1f77bcf86cd799439f02',
        _company: COMPANY_A,
        name: 'Older',
        markup: '<p data-ko-display="_root_.market eq \'be\'">B</p>',
        contract: { declared: {}, read: [], adopt: {}, compared: {} },
        contractVersion: CONTRACT_READER_VERSION - 1,
      },
    ]);
  });

  it('keeps a current contract as stored, and reads only the older one again', async () => {
    const findOne = jest.spyOn(models.Templates, 'findOne');

    const listed = await listTemplateContracts({ user: techAdminA });

    expect(listed.find((t) => t.name === 'Current').contract).toEqual(stored);
    expect(listed.find((t) => t.name === 'Older').contract.compared).toEqual([
      { property: 'market', literal: 'be', count: 1 },
    ]);
    expect(findOne).toHaveBeenCalledTimes(1);
    findOne.mockRestore();
  });

  it('stores the contract read again, so the next list reads no markup', async () => {
    await listTemplateContracts({ user: techAdminA });
    const findOne = jest.spyOn(models.Templates, 'findOne');

    await listTemplateContracts({ user: techAdminA });

    expect(findOne).not.toHaveBeenCalled();
    findOne.mockRestore();
  });
});

'use strict';

// The routes that change a company's taxonomy ask for `taxonomy.manage` (epic
// #1547, ADR-0026), and so does the bulk adoption of a template's emails
// (ADR-0024), until now the super admin's. The reads stay as they are.
//
// Guards are compared by identity on the actual express stack: GUARD_CAN keeps
// one middleware per capability. The adoption is scoped by its service: a tech
// admin adopts the emails of its own company's templates only.

jest.mock('../../../packages/server/common/models.common.js', () =>
  require('../../helpers/taxonomy-world.js').fakeTaxonomyModels()
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
// The template routes are read for their guards only.
jest.mock(
  '../../../packages/server/template/template.controller.js',
  () => new Proxy({}, { get: () => jest.fn() })
);

const models = require('../../../packages/server/common/models.common.js');
const {
  GUARD_ADMIN,
  GUARD_GROUP_ADMIN,
  GUARD_CAN,
} = require('../../../packages/server/account/auth.guard.js');
const { routeInspector } = require('../../helpers/express-router.js');
const {
  COMPANY_A,
  COMPANY_B,
  techAdminA,
} = require('../../helpers/taxonomy-world.js');

const techAdminB = { role: 'company_admin_tech', group: { id: COMPANY_B } };
const TEMPLATE_OF_A = '507f1f77bcf86cd799439f01';

const ROUTERS = {
  taxonomy: '../../../packages/server/taxonomy/taxonomy.routes.js',
  dimension: '../../../packages/server/taxonomy/dimension.routes.js',
  template: '../../../packages/server/template/template.routes.js',
};

const WRITES = [
  ['taxonomy', 'post', ''],
  ['taxonomy', 'patch', '/:itemId'],
  ['taxonomy', 'delete', '/:itemId'],
  ['taxonomy', 'post', '/default-email-types'],
  ['taxonomy', 'put', '/order'],
  ['dimension', 'put', '/order'],
  ['dimension', 'post', ''],
  ['dimension', 'patch', '/:dimensionId'],
  ['dimension', 'delete', '/:dimensionId'],
  ['template', 'get', '/:templateId/adoption'],
  ['template', 'post', '/:templateId/adoption'],
];

const guardsOf = (routerName, method, path) =>
  routeInspector(require(ROUTERS[routerName])).guardsOf(method, path);

describe('taxonomy routes guarded by taxonomy.manage', () => {
  it.each(WRITES)(
    '%s routes: %s %s asks for taxonomy.manage first',
    (routerName, method, path) => {
      expect(guardsOf(routerName, method, path)[0]).toBe(
        GUARD_CAN('taxonomy.manage')
      );
    }
  );

  it.each(WRITES)(
    '%s routes: %s %s no longer lets a company admin in',
    (routerName, method, path) => {
      const guards = guardsOf(routerName, method, path);

      expect(guards).not.toContain(GUARD_GROUP_ADMIN);
      expect(guards).not.toContain(GUARD_ADMIN);
    }
  );

  it('refuses a company admin at the guard', () => {
    const guard = GUARD_CAN('taxonomy.manage');
    const next = jest.fn();

    guard(
      { user: { role: 'company_admin', group: { id: COMPANY_A } } },
      {},
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('lets a tech admin through the guard', () => {
    const next = jest.fn();

    GUARD_CAN('taxonomy.manage')({ user: techAdminA }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  describe('the bulk adoption, for a tech admin', () => {
    let adoptForTemplate;

    beforeAll(() => {
      ({
        adoptForTemplate,
      } = require('../../../packages/server/template/template-adoption.service.js'));
    });

    beforeEach(() => {
      models.Templates.reset();
      models.Mailings.reset();
      models.Templates.seed([
        { _id: TEMPLATE_OF_A, _company: COMPANY_A, markup: '<p>Plain</p>' },
      ]);
    });

    it("previews the emails of its own company's template", async () => {
      await expect(
        adoptForTemplate({
          user: techAdminA,
          templateId: TEMPLATE_OF_A,
          apply: false,
        })
      ).resolves.toMatchObject({ emails: [] });
    });

    it("answers not found on another company's template", async () => {
      await expect(
        adoptForTemplate({
          user: techAdminB,
          templateId: TEMPLATE_OF_A,
          apply: true,
        })
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});

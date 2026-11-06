'use strict';

/**
 * The routes of the skills and expertises back office, on their real
 * controllers and services, for a test that seeds the fake models
 * (mcp-fake-models.js) and reads what an HTTP call answers. A test file
 * mocks the models and the guard itself (Jest hoists `jest.mock` to the file
 * that calls it):
 *
 *   jest.mock('…/packages/server/common/models.common', () => {
 *     const { createMcpStore } = require('…/helpers/mcp-fake-models.js');
 *     const store = createMcpStore();
 *     return { ...store.models, mockStore: store };
 *   });
 *   jest.mock('…/packages/server/account/auth.guard', () =>
 *     require('…/helpers/ai-skill-app.js').guardOnCapability()
 *   );
 */

const express = require('express');

const SUPER_ADMIN = Object.freeze({
  id: '507f1f77bcf86cd799439001',
  role: 'super_admin',
});

// The guard of the module, on the real rule: the platform capability.
function guardOnCapability() {
  const permissions = require('../../packages/server/account/permissions.js');
  const { CAPABILITIES } = require('../../packages/shared/access/roles.js');
  return {
    GUARD_ADMIN: (req, res, next) =>
      permissions.can(req.user, CAPABILITIES.PLATFORM_MANAGE)
        ? next()
        : res.status(401).json({ message: 'Unauthorized' }),
  };
}

/**
 * @param {Object} [user] the request user, a super admin by default
 * @returns {Object} an express app serving /api/ai-skills and
 *   /api/ai-expertise, answering an error as `{ message, ...its data }`
 */
function aiSkillApp(user = SUPER_ADMIN) {
  const {
    skillsRouter,
    expertiseRouter,
  } = require('../../packages/server/ai-skill/ai-skill.routes.js');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api/ai-skills', skillsRouter);
  app.use('/api/ai-expertise', expertiseRouter);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ ...err, message: err.message });
  });
  return app;
}

module.exports = { aiSkillApp, guardOnCapability, SUPER_ADMIN };

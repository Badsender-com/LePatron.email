'use strict';

const express = require('express');

const { GUARD_ADMIN } = require('../account/auth.guard.js');
const skill = require('./controllers/skill.controller.js');
const expertise = require('./controllers/expertise.controller.js');
const invocation = require('./controllers/invocation.controller.js');

const skillsRouter = express.Router();
skillsRouter.use(GUARD_ADMIN);

skillsRouter.get('/schemas', skill.listSchemas);
skillsRouter.get('/budget', skill.getBudget);
skillsRouter.get('/', skill.listSkills);
skillsRouter.post('/', skill.createSkill);
skillsRouter.get('/:skillId', skill.getSkill);
skillsRouter.patch('/:skillId', skill.updateSkill);
skillsRouter.post('/:skillId/versions/minor', skill.createMinorVersion);
skillsRouter.post('/:skillId/versions/major', skill.createMajorVersion);
skillsRouter.patch('/:skillId/versions/:version', skill.updateVersion);
skillsRouter.delete('/:skillId/versions/:version', skill.deleteVersion);
skillsRouter.post(
  '/:skillId/versions/:version/activate',
  skill.activateVersion
);
skillsRouter.post('/:skillId/archive', skill.archiveSkill);
skillsRouter.post('/:skillId/test', skill.testSkill);

const expertiseRouter = express.Router();
expertiseRouter.use(GUARD_ADMIN);
expertiseRouter.get('/', expertise.listExpertise);
expertiseRouter.post('/', expertise.createExpertise);
expertiseRouter.get('/:expertiseId', expertise.getExpertise);
expertiseRouter.patch('/:expertiseId', expertise.updateExpertise);
expertiseRouter.post(
  '/:expertiseId/versions/minor',
  expertise.createMinorVersion
);
expertiseRouter.post(
  '/:expertiseId/versions/major',
  expertise.createMajorVersion
);
expertiseRouter.patch(
  '/:expertiseId/versions/:version',
  expertise.updateVersion
);
expertiseRouter.delete(
  '/:expertiseId/versions/:version',
  expertise.deleteVersion
);
expertiseRouter.post(
  '/:expertiseId/versions/:version/activate',
  expertise.activateVersion
);
expertiseRouter.post('/:expertiseId/archive', expertise.archiveExpertise);

const invocationsRouter = express.Router();
invocationsRouter.use(GUARD_ADMIN);
invocationsRouter.get('/', invocation.listInvocations);
invocationsRouter.get('/:id', invocation.getInvocation);

module.exports = {
  skillsRouter,
  expertiseRouter,
  invocationsRouter,
};

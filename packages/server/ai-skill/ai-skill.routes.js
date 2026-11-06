'use strict';

const express = require('express');
const bodyParser = require('body-parser');

const { GUARD_ADMIN } = require('../account/auth.guard.js');
const skill = require('./controllers/skill.controller.js');
const expertise = require('./controllers/expertise.controller.js');
const invocation = require('./controllers/invocation.controller.js');
const skillsExport = require('./controllers/skills-export.controller.js');
const {
  skillPublication,
  expertisePublication,
} = require('./controllers/publication.controller.js');
const publicationBatch = require('./controllers/publication-batch.controller.js');

const skillsRouter = express.Router();
skillsRouter.use(GUARD_ADMIN);

// The skills export (ADR 0018), before the routes keyed by a skill id.
skillsRouter.post('/export', skillsExport.exportFile);
skillsRouter.post('/import/preview', skillsExport.previewFile);
skillsRouter.post('/import', skillsExport.importFile);
// Several drafts at once, skills and expertises alike (ADR 0019).
skillsRouter.post('/publications/plan', publicationBatch.plan);
skillsRouter.post('/publications/guard', publicationBatch.guard);
skillsRouter.post('/publications/cancel', publicationBatch.cancel);
skillsRouter.post('/publications', publicationBatch.publish);

// A skills export is 5 MB at most. Mounted by the app on the import routes
// before its own parser, which reads up to 50 MB: once a body is read, no
// later parser reads it again, whatever its announced size or encoding.
const skillsImportBodyParser = bodyParser.json({ limit: '5mb' });
skillsRouter.get('/schemas', skill.listSchemas);
skillsRouter.get('/schemas/:schemaId/descriptor', skill.getSchemaDescriptor);
skillsRouter.get('/', skill.listSkills);
skillsRouter.post('/', skill.createSkill);
skillsRouter.get('/:skillId', skill.getSkill);
skillsRouter.patch('/:skillId', skill.updateSkill);
skillsRouter.post('/:skillId/versions/minor', skill.createMinorVersion);
skillsRouter.post('/:skillId/versions/major', skill.createMajorVersion);
skillsRouter.patch('/:skillId/versions/:version', skill.updateVersion);
skillsRouter.get(
  '/:skillId/versions/:version/platform-only-expertises',
  skill.getPlatformOnlyExpertises
);
skillsRouter.delete('/:skillId/versions/:version', skill.deleteVersion);
skillsRouter.post(
  '/:skillId/versions/:version/activate',
  skill.activateVersion
);
// The publication guard (ADR 0019): what it replays, the replay, a cancel.
skillsRouter.get(
  '/:skillId/versions/:version/publication',
  skillPublication.plan
);
skillsRouter.post('/:skillId/versions/:version/guard', skillPublication.guard);
skillsRouter.post(
  '/:skillId/versions/:version/cancel-publication',
  skillPublication.cancel
);
skillsRouter.post('/:skillId/archive', skill.archiveSkill);

const expertiseRouter = express.Router();
expertiseRouter.use(GUARD_ADMIN);
expertiseRouter.get('/', expertise.listExpertise);
expertiseRouter.post('/', expertise.createExpertise);
// Static path — must precede '/:expertiseId' so it is not captured as an id.
expertiseRouter.get('/facets', expertise.getFacets);
expertiseRouter.get(
  '/:expertiseId/activation-impact',
  expertise.getActivationImpact
);
expertiseRouter.get(
  '/:expertiseId/open-task-skills',
  expertise.getOpenTaskSkills
);
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
expertiseRouter.get(
  '/:expertiseId/versions/:version/publication',
  expertisePublication.plan
);
expertiseRouter.post(
  '/:expertiseId/versions/:version/guard',
  expertisePublication.guard
);
expertiseRouter.post(
  '/:expertiseId/versions/:version/cancel-publication',
  expertisePublication.cancel
);
expertiseRouter.post('/:expertiseId/archive', expertise.archiveExpertise);

const invocationsRouter = express.Router();
invocationsRouter.use(GUARD_ADMIN);
invocationsRouter.get('/', invocation.listInvocations);
invocationsRouter.get('/:id', invocation.getInvocation);

module.exports = {
  skillsRouter,
  skillsImportBodyParser,
  expertiseRouter,
  invocationsRouter,
};

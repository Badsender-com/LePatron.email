'use strict';

const express = require('express');
const bodyParser = require('body-parser');

const { GUARD_ADMIN } = require('../account/auth.guard.js');
const skill = require('./controllers/skill.controller.js');
const expertise = require('./controllers/expertise.controller.js');
const invocation = require('./controllers/invocation.controller.js');
const skillsExport = require('./controllers/skills-export.controller.js');
const skillsSource = require('./controllers/skills-source.controller.js');
const skillsFollow = require('./controllers/skills-follow.controller.js');
const {
  skillCopies,
  expertiseCopies,
} = require('./controllers/skills-copy.controller.js');
const { createRateLimiter, clientIp } = require('../utils/rate-limit.js');
const {
  skillPublication,
  expertisePublication,
} = require('./controllers/publication.controller.js');

const skillsRouter = express.Router();
skillsRouter.use(GUARD_ADMIN);

// The skills export (ADR 0018), before the routes keyed by a skill id.
skillsRouter.post('/export', skillsExport.exportFile);
skillsRouter.post('/import/preview', skillsExport.previewFile);
skillsRouter.post('/import', skillsExport.importFile);
// Production's read tokens, for the copies that follow it (ADR 0019).
skillsRouter.get('/read-tokens', skillsSource.listTokens);
skillsRouter.post('/read-tokens', skillsSource.createToken);
skillsRouter.delete('/read-tokens/:tokenId', skillsSource.revokeToken);
// A copy following production, on demand.
skillsRouter.get('/follow', skillsFollow.showFollow);
skillsRouter.post('/follow', skillsFollow.followNow);

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
// On a copy: an item kept on the copy, or a version duplicated (ADR 0019).
skillsRouter.post('/:skillId/keep-on-copy', skillCopies.keep);
skillsRouter.delete('/:skillId/keep-on-copy', skillCopies.followAgain);
skillsRouter.post('/:skillId/duplicate-on-copy', skillCopies.duplicate);

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
expertiseRouter.post('/:expertiseId/keep-on-copy', expertiseCopies.keep);
expertiseRouter.delete(
  '/:expertiseId/keep-on-copy',
  expertiseCopies.followAgain
);
expertiseRouter.post(
  '/:expertiseId/duplicate-on-copy',
  expertiseCopies.duplicate
);

const invocationsRouter = express.Router();
invocationsRouter.use(GUARD_ADMIN);
invocationsRouter.get('/', invocation.listInvocations);
invocationsRouter.get('/:id', invocation.getInvocation);

// What a copy reads production with (ADR 0019): a read token, never a
// session, and the export only. Mounted by the app before the session. A copy
// follows on demand and every night: a few calls an hour are plenty, and a
// guessed token gets nowhere.
const HOUR = 60 * 60 * 1000;
const skillsSourceRouter = express.Router();
skillsSourceRouter.use(
  createRateLimiter({ windowMs: HOUR, max: 60, keyOf: clientIp })
);
skillsSourceRouter.get(
  '/export',
  skillsSource.requireReadToken,
  skillsSource.exportSource
);

module.exports = {
  skillsRouter,
  skillsSourceRouter,
  skillsImportBodyParser,
  expertiseRouter,
  invocationsRouter,
};

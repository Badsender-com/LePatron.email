'use strict';

const express = require('express');

const { GUARD_ADMIN } = require('../account/auth.guard.js');
const scenario = require('./controllers/scenario.controller.js');
const run = require('./controllers/run.controller.js');

const router = express.Router();
router.use(GUARD_ADMIN);

// Preview must be registered before /scenarios/:scenarioId to avoid
// accidentally matching the dynamic segment.
router.get('/preview-expertise-filter', scenario.previewExpertiseFilter);

router.get('/scenarios', scenario.listScenarios);
// Facets before /scenarios/:scenarioId so "facets" is not read as an id.
router.get('/scenarios/facets', scenario.getScenarioFacets);
router.post('/scenarios', scenario.createScenario);
router.get('/scenarios/:scenarioId', scenario.getScenario);
router.patch('/scenarios/:scenarioId', scenario.updateScenario);
router.delete('/scenarios/:scenarioId', scenario.deleteScenario);
router.post('/scenarios/:scenarioId/execute', scenario.executeScenario);
router.get('/scenarios/:scenarioId/runs', run.listRuns);

router.get('/runs/:runId', run.getRun);
router.patch('/runs/:runId/feedback', run.setFeedback);
router.post('/runs/:runId/mark-golden', run.markGolden);
router.post('/runs/:runId/unmark-golden', run.unmarkGolden);
router.delete('/runs/:runId', run.deleteRun);

module.exports = router;

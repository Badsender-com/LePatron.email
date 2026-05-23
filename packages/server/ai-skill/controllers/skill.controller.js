'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

const skillService = require('../services/skill.service.js');
const skillInvocation = require('../services/skill-invocation.service.js');
const testBudget = require('../services/test-budget.service.js');
const { listSchemaIds } = require('../schemas');

function userIdOf(req) {
  return req.user && !req.user.isAdmin ? req.user.id : null;
}

module.exports = {
  listSkills: asyncHandler(async (req, res) => {
    const data = await skillService.listSkills(req.query);
    res.json(data);
  }),

  getSkill: asyncHandler(async (req, res) => {
    const skill = await skillService.getSkill(req.params.skillId);
    res.json(skill);
  }),

  createSkill: asyncHandler(async (req, res) => {
    const skill = await skillService.createSkill(req.body, userIdOf(req));
    res.status(201).json(skill);
  }),

  updateSkill: asyncHandler(async (req, res) => {
    const skill = await skillService.updateSkill(req.params.skillId, req.body);
    res.json(skill);
  }),

  createVersion: asyncHandler(async (req, res) => {
    const skill = await skillService.createVersion(
      req.params.skillId,
      req.body,
      userIdOf(req)
    );
    res.status(201).json(skill);
  }),

  updateVersion: asyncHandler(async (req, res) => {
    const skill = await skillService.updateVersion(
      req.params.skillId,
      req.params.versionNumber,
      req.body,
      userIdOf(req)
    );
    res.json(skill);
  }),

  activateVersion: asyncHandler(async (req, res) => {
    const skill = await skillService.activateVersion(
      req.params.skillId,
      req.params.versionNumber,
      req.body,
      userIdOf(req)
    );
    res.json(skill);
  }),

  archiveSkill: asyncHandler(async (req, res) => {
    const skill = await skillService.archiveSkill(req.params.skillId);
    res.json(skill);
  }),

  testSkill: asyncHandler(async (req, res) => {
    const { input, groupId } = req.body;
    if (!groupId) throw createError(400, 'groupId is required');
    const budget = await testBudget.consumeBudget(userIdOf(req));
    const result = await skillInvocation.invoke({
      skillId: req.params.skillId,
      input,
      groupId,
      userId: userIdOf(req),
      featureType: 'admin.test-runner',
    });
    res.json({ ...result, budget });
  }),

  getBudget: asyncHandler(async (req, res) => {
    res.json(await testBudget.getBudget(userIdOf(req)));
  }),

  listSchemas: asyncHandler(async (_req, res) => {
    res.json({ schemas: listSchemaIds() });
  }),
};

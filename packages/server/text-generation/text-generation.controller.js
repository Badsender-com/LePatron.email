'use strict';

const asyncHandler = require('express-async-handler');
const textGenerationService = require('./text-generation.service.js');

/**
 * @api {post} /text-generation/subject Subject proposals for an email
 * @apiPermission user
 * @apiName GenerateSubjects
 * @apiGroup TextGeneration
 *
 * @apiParam (Body) {String} mailingId the email being edited
 * @apiParam (Body) {Object[]} content its text as the editor shows it: `{ role, text }`
 * @apiParam (Body) {String} [currentSubject]
 * @apiParam (Body) {String} [brief] an instruction of the user
 * @apiParam (Body) {String[]} [avoid] proposals already seen
 *
 * @apiSuccess {Object[]} proposals `{ text, angle, facts }`
 * @apiSuccess {Number} dropped proposals set aside for breaking a rule
 */
async function generateSubject(req, res) {
  res.json(
    await textGenerationService.generateSubjects({
      user: req.user,
      body: req.body,
    })
  );
}

/**
 * @api {post} /text-generation/preheader Preheader proposals, built from the picked subject if any
 * @apiPermission user
 * @apiName GeneratePreheaders
 * @apiGroup TextGeneration
 *
 * @apiParam (Body) {String} mailingId the email being edited
 * @apiParam (Body) {Object[]} content its text as the editor shows it: `{ role, text }`
 * @apiParam (Body) {String} [subject] the subject the user picked; without it, the preheader carries the main point of the email
 * @apiParam (Body) {String} [currentPreheader]
 * @apiParam (Body) {String} [brief] an instruction of the user
 * @apiParam (Body) {String[]} [avoid] proposals already seen
 *
 * @apiSuccess {Object[]} proposals `{ text, angle, facts }`
 * @apiSuccess {Number} dropped proposals set aside for breaking a rule
 */
async function generatePreheader(req, res) {
  res.json(
    await textGenerationService.generatePreheaders({
      user: req.user,
      body: req.body,
    })
  );
}

module.exports = {
  generateSubject: asyncHandler(generateSubject),
  generatePreheader: asyncHandler(generatePreheader),
};

'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const copies = require('../services/skills-copy.service.js');
const { parseVersionParam } = require('../services/version-helpers.js');

/**
 * The routes of a copy for one kind of item (ADR 0019), keyed by `param`
 * (`skillId`, `expertiseId`): keep it on the copy (POST and DELETE
 * `/:id/keep-on-copy`) and duplicate a version of it
 * (`POST /:id/duplicate-on-copy`, `{ version: 'M.m' }`). Each answers the
 * item, the new one for a duplication, and refuses on an instance that is
 * not a copy (409 SKILLS_NOT_A_COPY).
 *
 * @param {'skill'|'expertise'} kind
 * @param {string} param
 */
function copyRoutesOf(kind, param) {
  return {
    keep: asyncHandler(async (req, res) => {
      copies.assertCopy();
      res.json(await copies.keepOnCopy(kind, req.params[param], req.user.id));
    }),
    followAgain: asyncHandler(async (req, res) => {
      copies.assertCopy();
      res.json(await copies.followProductionAgain(kind, req.params[param]));
    }),
    duplicate: asyncHandler(async (req, res) => {
      copies.assertCopy();
      const { version } = req.body || {};
      const ref = typeof version === 'string' && parseVersionParam(version);
      if (!ref) {
        throw createError(404, ERROR_CODES.SKILLS_COPY_VERSION_NOT_FOUND, {
          id: req.params[param],
          version: String(version),
        });
      }
      res
        .status(201)
        .json(
          await copies.duplicateOnCopy(
            kind,
            req.params[param],
            ref,
            req.user.id
          )
        );
    }),
  };
}

module.exports = {
  skillCopies: copyRoutesOf('skill', 'skillId'),
  expertiseCopies: copyRoutesOf('expertise', 'expertiseId'),
};

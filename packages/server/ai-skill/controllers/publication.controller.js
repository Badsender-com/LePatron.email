'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const { guardKeyIn } = require('../services/guard-key.js');
const guardRuns = require('../services/guard-runs.js');
const publication = require('../services/skills-publication.service.js');
const { parseVersionParam } = require('../services/version-helpers.js');

/**
 * The publication guard on the back office (ADR 0019, #1430): what it would
 * replay, the replay itself, started as a task of the server, and a
 * cancellation after it. Publishing goes
 * through the activate route of each kind, which asks for the guard when a
 * feature uses the version.
 *
 * @param {'skill'|'expertise'} kind
 * @param {string} idParam the route parameter holding the identifier
 */
function publicationController(kind, idParam) {
  function target(req) {
    const version = parseVersionParam(req.params.version);
    if (!version) {
      throw createError(400, ERROR_CODES.SKILL_PUBLICATION_VERSION_INVALID);
    }
    return { kind, id: req.params[idParam], version };
  }

  return {
    plan: asyncHandler(async (req, res) => {
      res.json(await publication.planPublication(target(req)));
    }),

    // Started on the server, answered at once: the page reads it again
    // until it is done (guard-runs.js).
    guard: asyncHandler(async (req, res) => {
      const asked = target(req);
      const plan = await publication.planPublication(asked);
      res.json(
        await guardRuns.startGuard(
          {
            targets: [asked],
            plan,
            run: () => publication.guardPublication(asked, req.user),
          },
          req.user
        )
      );
    }),

    cancel: asyncHandler(async (req, res) => {
      res.json(
        await publication.cancelPublication(
          { ...target(req), guardKey: guardKeyIn(req.body) },
          req.user
        )
      );
    }),

    // The key of the guard, when one ran, rides along with the changelog and release
    // notes of the version, with the opening the publication asks for
    // (`openToAll`, and a skill's `openExpertiseIds`, ADR 0013), whether a copy
    // keeps the item it publishes (`keepOnCopy`, ADR 0019), and with the
    // update date of the draft the page read, on which it publishes (ADR 0014).
    publish(req) {
      const {
        changelog,
        releaseNotes,
        openToAll,
        openExpertiseIds,
        keepOnCopy,
        updatedAt,
      } = req.body || {};
      return publication.publishVersion(
        {
          ...target(req),
          guardKey: guardKeyIn(req.body),
          payload: {
            changelog,
            releaseNotes,
            openToAll,
            openExpertiseIds,
            keepOnCopy,
            updatedAt,
          },
        },
        req.user
      );
    },
  };
}

module.exports = {
  skillPublication: publicationController('skill', 'skillId'),
  expertisePublication: publicationController('expertise', 'expertiseId'),
};

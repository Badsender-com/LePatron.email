'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const publication = require('../services/skills-publication.service.js');
const { parseVersionParam } = require('../services/version-helpers.js');

/**
 * The publication guard on the back office (ADR 0019, #1430): what it would
 * replay, the replay itself, and a cancellation after it. Publishing goes
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
      throw createError(400, 'Invalid version format (expected "major.minor")');
    }
    return { kind, id: req.params[idParam], version };
  }

  return {
    plan: asyncHandler(async (req, res) => {
      res.json(await publication.planPublication(target(req)));
    }),

    guard: asyncHandler(async (req, res) => {
      res.json(await publication.guardPublication(target(req)));
    }),

    cancel: asyncHandler(async (req, res) => {
      res.json(
        await publication.cancelPublication(
          { ...target(req), guard: (req.body || {}).guard },
          req.user
        )
      );
    }),

    // The guard, when one ran, rides along with the changelog and release
    // notes of the version, and with the opening the publication asks for
    // (`openToAll`, and a skill's `openExpertiseIds`, ADR 0013).
    publish(req) {
      const { guard, changelog, releaseNotes, openToAll, openExpertiseIds } =
        req.body || {};
      return publication.publishVersion(
        {
          ...target(req),
          guard,
          payload: { changelog, releaseNotes, openToAll, openExpertiseIds },
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

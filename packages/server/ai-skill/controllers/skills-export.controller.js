'use strict';

const asyncHandler = require('express-async-handler');

const { exportSkills } = require('../services/skills-export.service.js');
const { siteOrigin } = require('../../email-templates/email-template.js');

// The file's name says where and when it was exported:
// lepatron-skills-<instance>-<date>.json.
function fileNameOf(origin, exportedAt) {
  const instance = new URL(origin).host.replace(/[^a-z0-9.-]/gi, '-');
  return `lepatron-skills-${instance}-${exportedAt.slice(0, 10)}.json`;
}

/**
 * POST /api/ai-skills/export: the skills export of a selection
 * (`skillIds`, `expertiseIds`, `withoutExpertiseIds`) or of everything
 * (`all`), as a download (ADR 0018).
 */
const exportFile = asyncHandler(async (req, res) => {
  const { skillIds, expertiseIds, withoutExpertiseIds, all } = req.body || {};
  const file = await exportSkills(
    { skillIds, expertiseIds, withoutExpertiseIds, all: all === true },
    { user: req.user, origin: siteOrigin() }
  );
  res.set(
    'Content-Disposition',
    `attachment; filename="${fileNameOf(file.origin, file.exportedAt)}"`
  );
  res.type('application/json').send(JSON.stringify(file, null, 2));
});

module.exports = { exportFile };

'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

const {
  exportSkills,
  previewImport,
  importSkills,
} = require('../services/skills-export.service.js');
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

// A skills export is refused over 5 MB (ADR 0018). The app has read the
// body already, up to its own 50 MB: the size the request announced decides.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function capFileSize(req, _res, next) {
  const size = Number(req.headers['content-length'] || 0);
  if (size > MAX_FILE_BYTES) {
    return next(createError(413, 'A skills export is 5 MB at most.'));
  }
  return next();
}

/**
 * POST /api/ai-skills/import/preview: what importing the file would do here,
 * item by item, writing nothing. A file that cannot be read is refused whole.
 */
const previewFile = asyncHandler(async (req, res) => {
  res.json(await previewImport(req.body));
});

/**
 * POST /api/ai-skills/import: the chosen items of the file (`file`,
 * `expertiseIds`, `skillIds`) imported as drafts; answers the report.
 */
const importFile = asyncHandler(async (req, res) => {
  const { file, expertiseIds, skillIds } = req.body || {};
  res.json(
    await importSkills(file, { expertiseIds, skillIds }, { user: req.user })
  );
});

module.exports = { exportFile, previewFile, importFile, capFileSize };

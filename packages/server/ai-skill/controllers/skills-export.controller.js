'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { z } = require('zod');

const {
  exportSkills,
  previewImport,
  importSkills,
} = require('../services/skills-export.service.js');
const { SkillIdRegex } = require('../constant/skill-constants.js');
const { siteOrigin } = require('../../email-templates/email-template.js');

// The file's name says where and when it was exported:
// lepatron-skills-<instance>-<date>.json.
function fileNameOf(origin, exportedAt) {
  const instance = new URL(origin).host.replace(/[^a-z0-9.-]/gi, '-');
  return `lepatron-skills-${instance}-${exportedAt.slice(0, 10)}.json`;
}

// A selection is lists of ids: a lone string would be read letter by letter.
const ids = z.array(z.string().regex(SkillIdRegex)).optional();
const SELECTION = z.object({
  skillIds: ids,
  expertiseIds: ids,
  withoutExpertiseIds: ids,
  all: z.boolean().optional(),
});
const CHOICE = z.object({
  file: z.unknown(),
  skillIds: ids,
  expertiseIds: ids,
});

function bodyOf(req, schema) {
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    throw createError(400, `${issue.path.join('.')}: ${issue.message}`);
  }
  return parsed.data;
}

/**
 * POST /api/ai-skills/export: the skills export of a selection
 * (`skillIds`, `expertiseIds`, `withoutExpertiseIds`) or of everything
 * (`all`), as a download (ADR 0018).
 */
const exportFile = asyncHandler(async (req, res) => {
  const { all, ...selection } = bodyOf(req, SELECTION);
  const file = await exportSkills(
    { ...selection, all: all === true },
    { user: req.user, origin: siteOrigin() }
  );
  res.set(
    'Content-Disposition',
    `attachment; filename="${fileNameOf(file.origin, file.exportedAt)}"`
  );
  res.type('application/json').send(JSON.stringify(file, null, 2));
});

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
  const { file, expertiseIds, skillIds } = bodyOf(req, CHOICE);
  res.json(
    await importSkills(file, { expertiseIds, skillIds }, { user: req.user })
  );
});

module.exports = { exportFile, previewFile, importFile };

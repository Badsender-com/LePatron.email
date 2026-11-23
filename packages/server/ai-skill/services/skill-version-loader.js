'use strict';

const { LePatronSkills } = require('../../common/models.common.js');
const { getSchema } = require('../schemas');
const { SkillStatuses } = require('../constant/skill-constants.js');
const { configError } = require('./invocation-config-error.js');

/**
 * The skill an invocation runs and the version it runs at: the pinned one, or
 * the active one. Both missing cases are configuration failures, never
 * provider failures.
 *
 * @param {Object} params
 * @param {string} params.skillId
 * @param {{major: number, minor?: number}} [params.versionRef] a pinned version
 * @param {boolean} [params.unpublished] also reach a skill never published, or
 *   archived, when a version is pinned (the publication guard)
 * @returns {Promise<{ skill: Object, version: Object }>}
 */
async function loadSkillVersion({ skillId, versionRef, unpublished }) {
  const skill = await LePatronSkills.findOne(
    {
      skillId,
      ...(!(unpublished && versionRef) && {
        status: SkillStatuses.ACTIVE,
      }),
    },
    {
      skillId: 1,
      audience: 1,
      activeVersion: 1,
      versions: 1,
    }
  );
  if (!skill) {
    // Typed like the group/integration failures: "this environment's data
    // does not match the deployed code" is a configuration problem, and the
    // caller must be able to tell it apart from a provider outage.
    throw configError(404, `Skill "${skillId}" not found or not ACTIVE`);
  }

  const activeRef = skill.activeVersion || {};
  const wantedMajor = versionRef ? versionRef.major : activeRef.major;
  const wantedMinor = versionRef ? versionRef.minor || 0 : activeRef.minor || 0;
  const version = (skill.versions || []).find(
    (v) => v.versionMajor === wantedMajor && v.versionMinor === wantedMinor
  );
  if (!version) {
    // A missing pinned version is the caller's mistake (404); a missing
    // active version is a data integrity bug (500).
    throw configError(
      versionRef ? 404 : 500,
      versionRef
        ? `Version ${wantedMajor}.${wantedMinor} of skill "${skillId}" not found`
        : `Skill "${skillId}" has activeVersion=${wantedMajor}.${wantedMinor} but the version is missing`
    );
  }
  return { skill, version };
}

/**
 * The schemas a version names, both resolved before anything is called: an
 * id that no longer resolves (schema renamed or removed in code while a
 * version still points at it) otherwise surfaced as a TypeError *after* the
 * provider call had been made and billed.
 *
 * @param {string} skillId
 * @param {Object} version
 * @returns {{ inputSchema: import('zod').ZodTypeAny, outputSchema: import('zod').ZodTypeAny }}
 */
function versionSchemas(skillId, version) {
  const label = `Skill "${skillId}" v${version.versionMajor}.${version.versionMinor}`;
  const inputSchema = getSchema(version.inputSchemaId);
  if (!inputSchema) {
    throw configError(
      500,
      `${label} references unknown input schema "${version.inputSchemaId}"`
    );
  }
  const outputSchema = getSchema(version.outputSchemaId);
  if (!outputSchema) {
    throw configError(
      500,
      `${label} references unknown output schema "${version.outputSchemaId}"`
    );
  }
  return { inputSchema, outputSchema };
}

module.exports = { loadSkillVersion, versionSchemas };

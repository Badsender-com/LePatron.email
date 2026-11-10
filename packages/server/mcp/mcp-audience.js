'use strict';

// Opening or closing a skill or an expertise from an assistant (ADR 0019,
// amending ADR 0014): two calls, as a publication. The first changes nothing:
// it answers which version clients will read and what the change leaves
// behind, with a key bound to that change. The second applies it on that key,
// only if what was checked is still so.

const createError = require('http-errors');
const expertiseService = require('../ai-skill/services/expertise.service.js');
const skillService = require('../ai-skill/services/skill.service.js');
const {
  findActiveVersion,
  versionLabel: label,
} = require('../ai-skill/services/version-helpers.js');
const {
  Audiences,
  SkillStatuses,
} = require('../ai-skill/constant/skill-constants.js');
const {
  platformOnlyExpertises,
} = require('../ai-skill/services/consumed-expertises.js');
const {
  assertOpenable,
  openTaskSkillsConsuming,
} = require('../ai-skill/services/audience-opening.js');
const logger = require('../utils/logger.js');
const { keyOf, claimsOf, isExpired } = require('./mcp-confirmation.js');

const PURPOSE = 'mcp-audience';

// Said in an answer, when what the change leaves behind could not be read.
const WARNING_UNCHECKED = 'WARNING_UNCHECKED';

const getters = {
  skill: (id) => skillService.getSkill(id),
  expertise: (id) => expertiseService.getExpertise(id),
};

// What opening or closing leaves behind: a failure to read it is logged and
// said, never answered as an error. The expertises chosen to open with a
// skill are not left behind.
async function audienceNotes({ kind, id, active, opening, toOpen }) {
  try {
    if (kind === 'skill' && opening) {
      const kept = await platformOnlyExpertises(active);
      return {
        platformOnlyExpertises: kept.filter(
          (e) => !toOpen.includes(e.expertiseId)
        ),
      };
    }
    if (kind === 'expertise' && !opening) {
      return { openTaskSkills: await openTaskSkillsConsuming(id) };
    }
    return {};
  } catch (error) {
    logger.error(
      `[mcp] what the audience of ${kind} ${id} leaves behind could not be read`,
      error
    );
    return { warnings: [{ code: WARNING_UNCHECKED }] };
  }
}

// What the change is, refused before anything is checked or written when it
// cannot be made.
async function changeOf({ kind, id, audience, openExpertiseIds }) {
  const doc = await getters[kind](id);
  const active = findActiveVersion(doc);
  const opening = audience === Audiences.ALL;
  if (opening && doc.status === SkillStatuses.ARCHIVED) {
    throw createError(409, `"${id}" is archived: it is opened to no company.`);
  }
  if (opening && !active) {
    throw createError(
      409,
      `"${id}" was never published: a person publishes a version before it is opened.`
    );
  }
  if (openExpertiseIds !== undefined && (kind !== 'skill' || !opening)) {
    throw createError(
      400,
      'openExpertiseIds goes only with opening a skill to every company.'
    );
  }
  const toOpen =
    kind === 'skill'
      ? await assertOpenable(active, openExpertiseIds, opening)
      : [];
  return { doc, active, opening, toOpen: [...toOpen].sort() };
}

// What the key binds: the change asked, and what it was checked against.
const claimsFor = ({ kind, id, audience }, { doc, active, toOpen }, user) => ({
  kind,
  id,
  audience,
  open: toOpen,
  from: doc.audience,
  reads: active ? label(active) : null,
  by: String(user.id),
});

function assertKey(claims, expected) {
  const sameChange =
    claims &&
    ['kind', 'id', 'audience', 'by'].every(
      (field) => claims[field] === expected[field]
    ) &&
    JSON.stringify(claims.open) === JSON.stringify(expected.open);
  if (!sameChange) {
    throw createError(
      400,
      'This confirmation key was not given for this change: call set_audience without one to check it first.'
    );
  }
  if (isExpired(claims)) {
    throw createError(
      409,
      'This confirmation key has expired: call set_audience without one to check the change again.'
    );
  }
  if (claims.from !== expected.from || claims.reads !== expected.reads) {
    throw createError(
      409,
      'The audience or the active version changed after the check: call set_audience without a confirmation to check it again.'
    );
  }
}

async function apply({ kind, id, audience }, toOpen) {
  if (kind === 'skill') {
    const { skill, warnings } = await skillService.updateSkill(id, {
      audience,
      ...(toOpen.length && { openExpertiseIds: toOpen }),
    });
    return { saved: skill, warnings };
  }
  const saved = await expertiseService.updateExpertise(id, { audience });
  return { saved, warnings: [] };
}

/**
 * Opens an active skill or expertise to every company, or keeps it to the
 * platform company again, through the services the back office uses (ADR
 * 0019, ADR 0013). Clients read the active version only, so a version never
 * published is never opened. A task skill opened may open with it the
 * consumed expertises still kept to the platform company, chosen one by one
 * (`openExpertiseIds`), as the back office's confirmation offers; the answer
 * lists those it leaves kept, and, for an expertise kept again, the open task
 * skills that consume it. Without a confirmation, nothing changes.
 */
async function setAudience(args, user) {
  const { kind, id, audience, confirmation } = args;
  const change = await changeOf(args);
  const expected = claimsFor(args, change, user);
  if (confirmation === undefined) {
    const notes = await audienceNotes({ kind, id, ...change });
    return {
      id,
      audience,
      clientsRead: expected.reads,
      changed: false,
      ...notes,
      warnings: notes.warnings || [],
      confirmation: keyOf(PURPOSE, expected),
    };
  }
  assertKey(claimsOf(PURPOSE, confirmation), expected);
  const { saved, warnings } = await apply(args, change.toOpen);
  const notes = await audienceNotes({ kind, id, ...change });
  return {
    id,
    audience: saved.audience,
    clientsRead: expected.reads,
    changed: true,
    ...notes,
    warnings: [...warnings, ...(notes.warnings || [])],
  };
}

module.exports = { setAudience };

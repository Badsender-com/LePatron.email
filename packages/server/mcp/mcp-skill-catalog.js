'use strict';

const { LePatronSkills } = require('../common/models.common.js');
const { SkillNatures } = require('../ai-skill/constant/skill-constants.js');
const { describeSchema } = require('../ai-skill/schemas/describe-schema.js');
const {
  PLACEHOLDER_REGEX,
} = require('../ai-skill/services/prompt-builder.service.js');
const { audienceFilter } = require('./mcp-audience.js');
const { servedStatuses, servedVersion } = require('./mcp-drafts.js');

// The expertise a feature skill applies is composed by the feature that calls
// it in the app (findApplicable, with that feature's own scope). An assistant
// has no such feature: it finds the expertises itself, never as an argument.
const EXPERTISE_FIELD = 'expertise';

const uriOf = (skillId) => `lepatron://skills/${skillId}`;
const isTask = (doc) => doc.nature === SkillNatures.TASK;
const versionOf = (version) =>
  `${version.versionMajor}.${version.versionMinor}`;

// What reaches assistants (ADR 0013): an active skill the group may read, a
// task skill always, a feature skill only when marked so; in drafts mode, one
// never published too (#1385).
function servedFilter(group, drafts) {
  return {
    status: servedStatuses(drafts),
    ...audienceFilter(group),
    $or: [{ nature: SkillNatures.TASK }, { servedToAssistants: true }],
  };
}

/**
 * The skills a group is served, at their active version, or in drafts mode at
 * their latest draft (#1385).
 *
 * @param {Object} group
 * @param {boolean} [drafts]
 */
async function servedSkills(group, drafts = false) {
  const docs = await LePatronSkills.find(servedFilter(group, drafts)).lean();
  return docs
    .map((doc) => servedVersion(doc, drafts))
    .filter(Boolean)
    .sort((a, b) => a.doc.skillId.localeCompare(b.doc.skillId));
}

async function servedSkill(skillId, group, drafts = false) {
  return servedVersion(
    await LePatronSkills.findOne({
      skillId: String(skillId),
      ...servedFilter(group, drafts),
    }).lean(),
    drafts
  );
}

// The placeholders of a template, by their first segment, the expertise
// excepted: `{{input.brief}}` gives `brief`.
function placeholdersOf(template) {
  const names = new Set();
  String(template || '').replace(PLACEHOLDER_REGEX, (_match, path) => {
    names.add(path.split('.')[0]);
    return '';
  });
  names.delete(EXPERTISE_FIELD);
  return [...names];
}

/**
 * Whether a feature skill applies expertises: its input schema takes them, or
 * its template places them.
 *
 * @param {Object} version the served version
 * @returns {boolean}
 */
function usesExpertise(version) {
  const described = describeSchema(version.inputSchemaId);
  if (described) return described.hasExpertiseField;
  const names = new Set();
  String(version.inputTemplate || '').replace(PLACEHOLDER_REGEX, (_m, path) => {
    names.add(path.split('.')[0]);
    return '';
  });
  return names.has(EXPERTISE_FIELD);
}

// What an assistant is told of the expertises a feature skill applies, since
// LePatron attaches none to it here.
const EXPERTISE_NOTICE =
  'This skill applies Badsender expertises, which are not attached to it here. Before running it, find the ones that apply to the piece of the email you work on with find_applicable_expertises, read them, and apply them.';

/**
 * The arguments of a skill's prompt. A task skill takes none: the user brings
 * what it needs into the conversation. A feature skill takes the fields of its
 * input schema when the code knows it, else the placeholders of its template,
 * all optional, so a skill for assistants needs no deployment.
 */
function argumentsOf({ doc, version }) {
  if (isTask(doc)) return [];
  const described = describeSchema(version.inputSchemaId);
  if (described) {
    return described.fields.map(({ name, required, description }) => ({
      name,
      description: description || `The ${name} the skill works on.`,
      required,
    }));
  }
  return placeholdersOf(version.inputTemplate).map((name) => ({
    name,
    description: `Fills {{${name}}} in the skill's template.`,
    required: false,
  }));
}

module.exports = {
  uriOf,
  isTask,
  versionOf,
  servedSkills,
  servedSkill,
  argumentsOf,
  usesExpertise,
  EXPERTISE_NOTICE,
};

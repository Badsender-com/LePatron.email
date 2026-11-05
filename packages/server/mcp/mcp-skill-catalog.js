'use strict';

const { LePatronSkills } = require('../common/models.common.js');
const {
  findPublished,
} = require('../ai-skill/repositories/published.repository.js');
const { SkillNatures } = require('../ai-skill/constant/skill-constants.js');
const { describeSchema } = require('../ai-skill/schemas/describe-schema.js');
const {
  PLACEHOLDER_REGEX,
} = require('../ai-skill/services/prompt-builder.service.js');
const { audienceFilter } = require('../ai-skill/services/audience.js');

// The expertise a feature skill applies is composed by the feature that calls
// it in the app (findApplicable, with that feature's own scope). An assistant
// has no such feature: it finds the expertises itself, never as an argument.
const EXPERTISE_FIELD = 'expertise';

const uriOf = (skillId) => `lepatron://skills/${skillId}`;
// The nature of a skill is its active version's (ADR 0013). One stored before
// natures were versioned has none, and is a feature skill.
const natureOf = (version) => version.nature || SkillNatures.FEATURE;
const isTask = (version) => natureOf(version) === SkillNatures.TASK;

// What each read keeps of a skill and of its active version: a listing names
// a skill and its arguments, a read runs it.
const LISTED = {
  doc: ['skillId', 'title', 'description', 'servedToAssistants'],
  version: ['nature', 'inputSchemaId', 'inputTemplate'],
};
const READ = {
  doc: LISTED.doc,
  version: [
    ...LISTED.version,
    'systemPrompt',
    'skillBody',
    'procedure',
    'consumedExpertiseIds',
  ],
};

// What reaches assistants (ADR 0013): a published skill the company may use,
// a task skill always, a feature skill only when the skill is marked so.
const isServed = ({ doc, version }) =>
  isTask(version) || doc.servedToAssistants === true;

async function servedSkills(group) {
  const found = await findPublished(
    LePatronSkills,
    audienceFilter(group),
    LISTED
  );
  return found
    .filter(isServed)
    .sort((a, b) => a.doc.skillId.localeCompare(b.doc.skillId));
}

async function servedSkill(skillId, group) {
  const [found] = await findPublished(
    LePatronSkills,
    { skillId: String(skillId), ...audienceFilter(group) },
    READ
  );
  return found && isServed(found) ? found : null;
}

// The paths a template places: `{{input.brand.name}}` gives `brand.name`.
function placeholderPaths(template) {
  const paths = new Set();
  String(template || '').replace(PLACEHOLDER_REGEX, (_match, path) => {
    paths.add(path);
    return '';
  });
  return [...paths];
}

const isExpertisePath = (path) => path.split('.')[0] === EXPERTISE_FIELD;

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
  return placeholderPaths(version.inputTemplate).some(isExpertisePath);
}

// What an assistant is told of the expertises a feature skill applies, since
// LePatron attaches none to it here.
const EXPERTISE_NOTICE =
  'This skill applies expertises, which are not attached to it here. Before running it, find the ones that apply to the piece of the email you work on with find_applicable_expertises, read them, and apply them.';

/**
 * The arguments of a skill's prompt. A task skill takes none: the user brings
 * what it needs into the conversation. A feature skill takes the fields of its
 * input schema when the code knows it, else the placeholders of its template,
 * all optional, so a skill for assistants needs no deployment. An argument is
 * a string, so a dotted placeholder is an argument by its whole path
 * (`brand.name`), which `inputOf` puts back where the template reads it.
 */
function argumentsOf({ version }) {
  if (isTask(version)) return [];
  const described = describeSchema(version.inputSchemaId);
  if (described) {
    return described.fields.map(({ name, required }) => ({ name, required }));
  }
  return placeholderPaths(version.inputTemplate)
    .filter((path) => !isExpertisePath(path))
    .map((name) => ({ name, required: false }));
}

// Never a key of the input: it would reach the prototype of every object.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * The input a skill's template reads, from the prompt's arguments: only the
 * arguments the skill declares, each at its path. A value already in place
 * keeps it, so `brand` and `brand.name` never overwrite each other.
 *
 * @param {Object} found the served skill and its version
 * @param {Object} args the arguments the client sends, strings by name
 * @returns {Object}
 */
function inputOf(found, args) {
  const input = Object.create(null);
  argumentsOf(found).forEach(({ name }) => {
    const keys = name.split('.');
    if (args[name] === undefined || keys.some((key) => UNSAFE_KEYS.has(key))) {
      return;
    }
    const last = keys.pop();
    let node = input;
    for (const key of keys) {
      if (node[key] === undefined) node[key] = Object.create(null);
      if (typeof node[key] !== 'object') return;
      node = node[key];
    }
    if (node[last] === undefined) node[last] = args[name];
  });
  return input;
}

module.exports = {
  uriOf,
  natureOf,
  isTask,
  servedSkills,
  servedSkill,
  argumentsOf,
  inputOf,
  usesExpertise,
  EXPERTISE_NOTICE,
};

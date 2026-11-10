'use strict';

// What makes a retex (ADR 0021), beyond its shape: a divergence diverges, on
// a passage of the version the user read; a complement brings something.
// Each check throws a message for the assistant.

const {
  parseSections,
} = require('../ai-skill/services/expertise-parser.service.js');
const { readableExpertise } = require('./mcp-expertises.js');
const { servedSkill } = require('./mcp-skill-catalog.js');
const { flat } = require('./mcp-retex-candidates.js');

// The text of a skill's version a quotation is looked for in.
const skillText = (version) =>
  [
    version.procedure,
    version.systemPrompt,
    version.skillBody,
    version.inputTemplate,
  ].join('\n');

// What the retex is about, as the user may read it, at the version read:
// throws a message for the assistant when it is not.
async function aboutOf({ kind, id }, identity) {
  const found =
    kind === 'skill'
      ? await servedSkill(id, identity.group, identity.drafts)
      : await readableExpertise(id, identity.group, identity.drafts);
  if (!found) {
    throw new Error(
      `Not found: the ${kind} ${id}, or this user may not read it.`
    );
  }
  return found;
}

// The passage, checked against the version: an expertise's section anchor,
// or a quotation of a skill.
function assertPassage(retex, about) {
  if (retex.section) {
    if (retex.about.kind !== 'expertise') {
      throw new Error('A section anchors an expertise: quote a skill instead.');
    }
    const { sections } = parseSections(about.version.body);
    if (!sections.some((section) => section.id === retex.section)) {
      throw new Error(
        `This version of ${retex.about.id} has no section [${retex.section}].`
      );
    }
  }
  if (retex.quote) {
    if (retex.about.kind !== 'skill') {
      throw new Error(
        'A quotation passes for a skill: give an expertise its section.'
      );
    }
    if (!flat(skillText(about.version)).includes(flat(retex.quote))) {
      throw new Error(
        `The quotation is not in this version of ${retex.about.id}.`
      );
    }
  }
}

// What makes a retex, beyond its shape: a divergence diverges, on a passage;
// a complement brings something, about an element or a kind of know-how.
function assertRetex(retex) {
  const passage = Boolean(retex.section || retex.quote);
  if (retex.kind === 'divergence') {
    if (!retex.about || !passage) {
      throw new Error(
        'A divergence needs its passage: the skill or expertise, and a section of an expertise or a quotation of a skill.'
      );
    }
    ['recommended', 'decided', 'why'].forEach((field) => {
      if (!flat(retex[field]))
        throw new Error(`A divergence needs "${field}".`);
    });
    if (flat(retex.recommended) === flat(retex.decided)) {
      throw new Error(
        'Not a divergence: what was decided is what was recommended.'
      );
    }
    return;
  }
  if (!flat(retex.brought)) {
    throw new Error('A complement needs what the user "brought".');
  }
  ['missing', 'source'].forEach((field) => {
    if (!flat(retex[field])) throw new Error(`A complement needs "${field}".`);
  });
  if (!retex.about && (!retex.category || !flat(retex.part))) {
    throw new Error(
      'A complement about no skill or expertise needs its category and the part of the email.'
    );
  }
}

/**
 * What a retex is about, as the user may read it, once the retex is checked.
 *
 * @param {Object} retex the assistant's arguments
 * @param {Object} identity who reports it
 * @returns {Promise<Object|null>} the skill or expertise and its version, or
 *   null for a complement about none
 * @throws {Error} a message for the assistant
 */
async function checkedAbout(retex, identity) {
  assertRetex(retex);
  if (!retex.about) return null;
  const about = await aboutOf(retex.about, identity);
  assertPassage(retex, about);
  return about;
}

module.exports = { checkedAbout };

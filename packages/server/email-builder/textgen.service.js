'use strict';

const { BadRequest } = require('http-errors');

const aiFeatureService = require('../ai-feature/ai-feature.service.js');
const expertiseRepo = require('../ai-skill/repositories/expertise.repository.js');
const skillInvocation = require('../ai-skill/services/skill-invocation.service.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
const ERROR_CODES = require('../constant/error-codes.js');

/**
 * POC textgen — generate the full content of an editor block through the
 * skills pipeline. The feature (not the skill) owns the orchestration:
 * fetch applicable expertise, compose the input, invoke, and enforce path
 * fidelity on the way out.
 *
 * `currentContent` is the editor's extraction of the block's text fields:
 * an array of { path, value } pairs (dot-notation paths as VALUES — BSON
 * forbids dots in persisted object keys).
 *
 * POC shortcut (to revisit for the real feature): the expertise scope is
 * hardcoded to { scope: 'cta', emailType: 'promo' } — the real feature must
 * resolve the scope from the nature of the block's fields (DSE/block-doc
 * design input).
 */
async function generateBlockText({
  groupId,
  userId,
  instruction,
  currentContent,
  fieldConstraints,
}) {
  // The Skills engine must be configured and active for this group (same
  // check the editor uses to show the button — re-checked server-side).
  const engine = await aiFeatureService.getActiveFeatureWithIntegration({
    groupId,
    featureType: AIFeatureTypes.SKILL,
  });
  if (!engine) {
    throw new BadRequest(ERROR_CODES.NO_INTEGRATION_FOR_FEATURE);
  }

  const applicable = await expertiseRepo.findApplicable({
    scope: 'cta',
    emailType: 'promo',
  });

  const input = {
    instruction,
    currentContent,
  };
  if (fieldConstraints) input.fieldConstraints = fieldConstraints;
  if (applicable.length) {
    input.expertise = applicable.map((e) => ({
      expertiseId: e.expertiseId,
      title: e.title,
      body: e.body,
      examplesGood: e.examplesGood,
      examplesBad: e.examplesBad,
    }));
  }

  const result = await skillInvocation.invoke({
    skillId: 'redaction.block.promo',
    input,
    groupId,
    userId,
    featureType: 'poc.textgen',
  });

  // Path fidelity: never inject a path the block did not expose. Invented
  // paths are dropped; omitted ones are reported so the UI can say
  // "3 champs sur 4 générés".
  const allowedPaths = new Set(currentContent.map((e) => e.path));
  const generated = (result.output || []).filter((e) =>
    allowedPaths.has(e.path)
  );
  const generatedPaths = new Set(generated.map((e) => e.path));
  const omittedPaths = [...allowedPaths].filter((p) => !generatedPaths.has(p));

  return { generated, omittedPaths };
}

module.exports = { generateBlockText };

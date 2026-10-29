'use strict';

const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');
const { LePatronSkills } = require('../common/models.common.js');
const {
  findActiveVersion,
} = require('../ai-skill/services/version-helpers.js');
const { SkillStatuses } = require('../ai-skill/constant/skill-constants.js');
const { describeSchema } = require('../ai-skill/schemas/describe-schema.js');
const {
  buildPrompt,
} = require('../ai-skill/services/prompt-builder.service.js');
const { resolveIdentity } = require('./mcp-identity.js');
const { audienceFilter } = require('./mcp-audience.js');

// The active version of an active skill: what an assistant runs (ADR 0012).
function published(doc) {
  if (!doc || doc.status !== SkillStatuses.ACTIVE) return null;
  const version = findActiveVersion(doc);
  if (!version || version.status !== SkillStatuses.ACTIVE) return null;
  return { doc, version };
}

// The fields of the skill's input schema, but the expertise, which the
// assistant reads as resources rather than types (describe-schema.js).
function argumentsOf(version) {
  const described = describeSchema(version.inputSchemaId);
  return (described ? described.fields : []).map((field) => ({
    name: field.name,
    required: field.required,
  }));
}

function asPrompt({ doc, version }) {
  return {
    name: doc.skillId,
    title: doc.title,
    description: doc.description || undefined,
    arguments: argumentsOf(version),
  };
}

function notFound(name) {
  return new ProtocolError(
    ProtocolErrorCode.InvalidParams,
    `Prompt not found: ${name}`
  );
}

async function listPrompts(ctx) {
  const { group } = await resolveIdentity(ctx.http?.authInfo);
  const docs = await LePatronSkills.find({
    status: SkillStatuses.ACTIVE,
    ...audienceFilter(group),
  }).lean();
  const prompts = docs
    .map(published)
    .filter(Boolean)
    .sort((a, b) => a.doc.skillId.localeCompare(b.doc.skillId))
    .map(asPrompt);
  return { prompts };
}

// The skill's instructions and its filled template, as the skill invocation
// builds them (prompt-builder.service.js), with the user's input fenced. An
// MCP prompt has no system role: the instructions come first, as the user's.
async function getPrompt(request, ctx) {
  const { group } = await resolveIdentity(ctx.http?.authInfo);
  const { name, arguments: input = {} } = request.params;
  const found = published(
    await LePatronSkills.findOne({
      skillId: String(name),
      ...audienceFilter(group),
    }).lean()
  );
  if (!found) throw notFound(name);

  const missing = argumentsOf(found.version).filter(
    (argument) => argument.required && !input[argument.name]
  );
  if (missing.length) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      `Missing required argument: ${missing.map((a) => a.name).join(', ')}`
    );
  }

  const { messages } = buildPrompt({ version: found.version, input });
  return {
    description: found.doc.description || undefined,
    messages: messages.map((message) => ({
      role: 'user',
      content: { type: 'text', text: message.content },
    })),
  };
}

/**
 * Skills change in the back office while the server runs, so their prompts
 * are answered from the database on each request, rather than registered
 * once like the tools.
 */
function registerSkillPrompts(server) {
  server.server.registerCapabilities({ prompts: {} });
  server.server.setRequestHandler('prompts/list', (_request, ctx) =>
    listPrompts(ctx)
  );
  server.server.setRequestHandler('prompts/get', getPrompt);
}

module.exports = { registerSkillPrompts };

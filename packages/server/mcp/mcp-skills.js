'use strict';

const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');
const {
  buildPrompt,
} = require('../ai-skill/services/prompt-builder.service.js');
const { resolveIdentity } = require('./mcp-identity.js');
const {
  isTask,
  servedSkills,
  servedSkill,
  argumentsOf,
} = require('./mcp-skill-catalog.js');
const expertises = require('./mcp-expertises.js');

function asPrompt(found) {
  return {
    name: found.doc.skillId,
    title: found.doc.title,
    description: found.doc.description || undefined,
    arguments: argumentsOf(found),
  };
}

const text = (content) => ({
  role: 'user',
  content: { type: 'text', text: content },
});

// A task skill: its procedure, then the active version of each expertise it
// consumes, in its order, embedded so it runs the Badsender way (ADR 0013).
// One the group may not read, or no longer published, is left out.
async function taskMessages({ doc, version }, group) {
  const consumed = await Promise.all(
    (version.consumedExpertiseIds || []).map((id) =>
      expertises.readableExpertise(id, group)
    )
  );
  return [
    text(`# ${doc.title}\n\n${version.procedure}`),
    ...consumed.filter(Boolean).map((found) => ({
      role: 'user',
      content: {
        type: 'resource',
        resource: {
          uri: expertises.uriOf(found.doc.expertiseId),
          mimeType: 'text/markdown',
          text: expertises.asMarkdown(found),
        },
      },
    })),
  ];
}

// A feature skill: the instructions and the filled template the skill
// invocation builds (prompt-builder.service.js), the user's input fenced, and
// never its JSON output contract, which only LePatron reads. An MCP prompt has
// no system role: the instructions come first, as the user's.
function featureMessages(found, input) {
  const missing = argumentsOf(found).filter(
    (argument) => argument.required && !input[argument.name]
  );
  if (missing.length) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      `Missing required argument: ${missing.map((a) => a.name).join(', ')}`
    );
  }
  const { messages } = buildPrompt({ version: found.version, input });
  return messages.map((message) => text(message.content));
}

async function listPrompts(ctx) {
  const { group } = await resolveIdentity(ctx.http?.authInfo);
  return { prompts: (await servedSkills(group)).map(asPrompt) };
}

async function getPrompt(request, ctx) {
  const { group } = await resolveIdentity(ctx.http?.authInfo);
  const { name, arguments: input = {} } = request.params;
  const found = await servedSkill(name, group);
  if (!found) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      `Prompt not found: ${name}`
    );
  }
  return {
    description: found.doc.description || undefined,
    messages: isTask(found.doc)
      ? await taskMessages(found, group)
      : featureMessages(found, input),
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

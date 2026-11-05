'use strict';

const {
  ProtocolError,
  ProtocolErrorCode,
} = require('@modelcontextprotocol/server');
const {
  buildPrompt,
} = require('../ai-skill/services/prompt-builder.service.js');
const { withIdentity } = require('./mcp-identity.js');
const {
  isTask,
  servedSkills,
  servedSkill,
  argumentsOf,
  inputOf,
  usesExpertise,
  EXPERTISE_NOTICE,
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
// consumes, in its order, embedded so it runs as the platform wrote it (ADR
// 0013). One the company may not read, or no longer published, is left out.
async function taskMessages({ doc, version }, group) {
  const consumed = await expertises.consumedExpertises(
    version.consumedExpertiseIds,
    group,
    { content: true }
  );
  return [
    text(`# ${doc.title}\n\n${version.procedure}`),
    ...consumed.map((found) => ({
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
function featureMessages(found, args) {
  const missing = argumentsOf(found).filter(
    (argument) => argument.required && !args[argument.name]
  );
  if (missing.length) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      `Missing required argument: ${missing.map((a) => a.name).join(', ')}`
    );
  }
  const { messages } = buildPrompt({
    version: found.version,
    input: inputOf(found, args),
  });
  return [
    ...messages.map((message) => text(message.content)),
    ...(usesExpertise(found.version) ? [text(EXPERTISE_NOTICE)] : []),
  ];
}

async function listPrompts({ group }) {
  return { prompts: (await servedSkills(group)).map(asPrompt) };
}

async function getPrompt({ group }, request) {
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
    messages: isTask(found.version)
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
  server.server.setRequestHandler('prompts/list', withIdentity(listPrompts));
  server.server.setRequestHandler('prompts/get', withIdentity(getPrompt));
}

module.exports = { registerSkillPrompts };

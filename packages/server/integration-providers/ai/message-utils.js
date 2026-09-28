'use strict';

/**
 * Split the OpenAI-style message list into a system instruction and the rest.
 *
 * Anthropic and Gemini both take the system prompt as a top-level field
 * instead of a message with `role: 'system'`, so both need this. Callers here
 * always send one — the translation path builds it explicitly — which is why
 * dropping it silently would be a quiet quality regression rather than a
 * visible failure.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {{ system: string|undefined, conversation: Array }}
 */
function splitSystemMessages(messages) {
  const systemParts = [];
  const conversation = [];

  for (const message of messages || []) {
    if (message.role === 'system') {
      systemParts.push(message.content);
    } else {
      conversation.push(message);
    }
  }

  return {
    // Joined rather than "first one wins": several system messages are legal
    // upstream, and losing the later ones would lose instructions.
    system: systemParts.length ? systemParts.join('\n\n') : undefined,
    conversation,
  };
}

module.exports = { splitSystemMessages };

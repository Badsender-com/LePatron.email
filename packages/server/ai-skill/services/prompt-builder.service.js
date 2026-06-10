'use strict';

const crypto = require('crypto');

const PLACEHOLDER_REGEX = /\{\{\s*input\.([a-zA-Z0-9_.]+)\s*\}\}/g;

/**
 * Build the messages array for a chat-completion call from a skill version.
 *
 * Prompt-injection protection (PLAN §4.4): user-provided input values are
 * wrapped in XML tags with a random per-invocation suffix so an attacker
 * cannot pre-craft a payload that closes the tag and injects instructions.
 *
 * The inputTemplate is interpolated with the user input. Tokens
 * `{{input.path.to.value}}` are looked up via dot-path on `input`.
 *
 * @param {Object} params
 * @param {{ systemPrompt: string, skillBody: string, inputTemplate: string }} params.version
 * @param {Object} params.input
 * @param {string} [params.suffix] — optional fixed suffix (mainly for tests)
 * @param {string|null} [params.outputContract] — auto-derived output-format
 *   block (see schemas/output-contract.js). Appended to the END of the static
 *   section (after skillBody): deterministic per skill version, so the static
 *   prefix stays prompt-caching friendly.
 * @returns {{ messages: Array<{role: string, content: string}>, suffix: string }}
 */
function buildPrompt({ version, input, suffix, outputContract }) {
  const tagSuffix = suffix || randomSuffix();
  const openTag = `<user_input_${tagSuffix}>`;
  const closeTag = `</user_input_${tagSuffix}>`;

  const interpolatedTemplate = (version.inputTemplate || '').replace(
    PLACEHOLDER_REGEX,
    (_match, path) => {
      const value = getByPath(input, path);
      if (value === undefined || value === null) return '';
      // Objects/arrays (e.g. the injected `expertise` entries) must be
      // serialized — String() would yield "[object Object]" and feed the LLM
      // garbage instead of the expertise content.
      return typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);
    }
  );

  const userContent = `${openTag}\n${interpolatedTemplate}\n${closeTag}`;

  const staticParts = [
    version.systemPrompt,
    version.skillBody,
    outputContract,
  ].filter((part) => part && String(part).trim().length > 0);

  const messages = [];
  if (staticParts.length) {
    messages.push({ role: 'system', content: staticParts.join('\n\n').trim() });
  }
  messages.push({ role: 'user', content: userContent });

  return { messages, suffix: tagSuffix };
}

function getByPath(obj, path) {
  if (obj === null || obj === undefined) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function randomSuffix() {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Tolerant JSON extraction from a raw LLM output:
 *   - strips optional ```json ... ``` code fences,
 *   - trims whitespace,
 *   - falls back to the first `{...}` or `[...]` block if the whole thing
 *     fails to parse.
 *
 * @param {string} raw
 * @returns {unknown}
 * @throws {Error} when no valid JSON can be extracted
 */
function parseJsonFromLLM(raw) {
  if (raw === null || raw === undefined) {
    throw new Error('Empty LLM output');
  }
  const text = String(raw);

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  const candidate = (fenceMatch ? fenceMatch[1] : text).trim();

  try {
    return JSON.parse(candidate);
  } catch (_e) {
    // Fall back to the first JSON-looking block in the text.
    const objMatch = candidate.match(/[{[][\s\S]*[}\]]/);
    if (objMatch) {
      return JSON.parse(objMatch[0]);
    }
    throw new Error('LLM output is not valid JSON');
  }
}

module.exports = {
  buildPrompt,
  parseJsonFromLLM,
  PLACEHOLDER_REGEX,
};

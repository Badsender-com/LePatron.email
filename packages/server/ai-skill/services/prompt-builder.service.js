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
 * Tolerant JSON extraction from a raw LLM output.
 *
 * Defense hierarchy (in order): (1) providers that support it are asked for
 * native `response_format: json_object` in skill-invocation — syntactically
 * valid JSON guaranteed; (2) the repair pass below covers providers WITHOUT
 * JSON mode (raw control chars inside strings — a real Mistral failure mode
 * pre-json_object); (3) failure surfaces as OUTPUT_PARSE. Every branch here
 * is reachable: json_object only covers openai/mistral today.
 *
 * Mechanics:
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

  const attempts = [candidate];
  // Fall back to the first JSON-looking block in the text.
  const objMatch = candidate.match(/[{[][\s\S]*[}\]]/);
  if (objMatch && objMatch[0] !== candidate) attempts.push(objMatch[0]);

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (_e) {
      // Repair pass: LLMs writing long Markdown inside a JSON string sometimes
      // switch from escaped \n to RAW newlines mid-string (seen with Mistral on
      // the QC skill) — invalid JSON. Re-escape raw control characters found
      // inside string literals, then retry.
      try {
        return JSON.parse(escapeRawControlCharsInStrings(attempt));
      } catch (_e2) {
        // try the next candidate
      }
    }
  }
  throw new Error('LLM output is not valid JSON');
}

/**
 * Walks the candidate tracking JSON string-literal state (quote toggling,
 * backslash escapes) and re-escapes raw \n, \r and \t found INSIDE strings.
 * Characters outside string literals are left untouched.
 */
function escapeRawControlCharsInStrings(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
    } else if (ch === '"') {
      inString = false;
      out += ch;
    } else if (ch === '\n') {
      out += '\\n';
    } else if (ch === '\r') {
      out += '\\r';
    } else if (ch === '\t') {
      out += '\\t';
    } else {
      out += ch;
    }
  }
  return out;
}

module.exports = {
  buildPrompt,
  parseJsonFromLLM,
  PLACEHOLDER_REGEX,
};

'use strict';

const { applyQuirks } = require('./param-quirks.js');

/**
 * How the Anthropic connector gets JSON back, and how it falls back when a
 * model refuses the way it asked.
 *
 * Three routes, from strongest to weakest:
 *
 * 1. Structured outputs (`output_config.format`). The answer is decoded
 *    against the schema, so its shape holds by construction — the forced tool
 *    let claude-opus-5 wrap the answer in an invented top-level key in more
 *    than half the calls of a golden run.
 * 2. A forced `emit_json` tool call, for models (or gateways) that refuse
 *    `output_config`. Works on generations 3 to 5.
 * 3. The same tool under `tool_choice: auto`, plus an instruction, for models
 *    that refuse a forced choice: claude-opus-5-5 answers 400 to it. Nothing
 *    guarantees the call, so the text answer is still read.
 *
 * Each fallback is a quirk learned from the refusal, through the same
 * machinery as the other providers' parameters: one refused request per model
 * and per TTL, not per call.
 */

const JSON_TOOL_NAME = 'emit_json';

const AUTO_TOOL_INSTRUCTION = `Answer by calling the ${JSON_TOOL_NAME} tool exactly once, with the whole answer as its input. Do not answer in prose.`;

// Anthropic's own wordings, matched on 400 only. Closed on purpose: anything
// else is a real error and is raised as one.
const OUTPUT_CONFIG_REFUSED = /\boutput_config\b/;
const FORCED_TOOL_REFUSED = /tool_choice: type "(?:tool|any)".* not supported/i;

const ADAPTATIONS = Object.freeze({
  output_config: 'json_via_tool',
  tool_choice: 'auto_tool_choice',
});

// Keywords structured outputs refuse. The SDKs strip them and check them
// client-side; this connector calls the API directly, and the zod schema
// checks them after the call anyway.
const UNSUPPORTED_KEYWORDS = new Set([
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'maxItems',
]);

const SCHEMA_MAPS = new Set(['properties', '$defs', 'definitions']);
const SCHEMA_LISTS = new Set(['anyOf', 'allOf', 'oneOf', 'prefixItems']);
const SCHEMA_CHILDREN = new Set(['items', 'not']);

// Internal markers, never returned: a keyword to leave out, and a schema
// structured outputs cannot express. Symbols rather than null, which is a
// legitimate keyword value (`const: null`).
const SKIP = Symbol('skip');
const UNEXPRESSIBLE = Symbol('unexpressible');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function convertMap(map) {
  const next = {};
  for (const [name, child] of Object.entries(map)) {
    const converted = convertSchema(child);
    if (converted === UNEXPRESSIBLE) return UNEXPRESSIBLE;
    next[name] = converted;
  }
  return next;
}

function convertList(list) {
  const next = list.map(convertSchema);
  return next.includes(UNEXPRESSIBLE) ? UNEXPRESSIBLE : next;
}

function convertKeyword(key, value) {
  if (UNSUPPORTED_KEYWORDS.has(key)) return SKIP;
  // Only 0 and 1 are accepted.
  if (key === 'minItems' && value > 1) return SKIP;
  if (SCHEMA_MAPS.has(key) && isPlainObject(value)) return convertMap(value);
  if (SCHEMA_LISTS.has(key) && Array.isArray(value)) return convertList(value);
  if (SCHEMA_CHILDREN.has(key)) return convertSchema(value);
  return value;
}

// An open map has no equivalent: closing it would forbid every key.
function closeObject(schema) {
  if (schema.type !== 'object') return schema;
  if (schema.additionalProperties) return UNEXPRESSIBLE;
  return { ...schema, additionalProperties: false };
}

function convertSchema(schema) {
  if (!isPlainObject(schema)) return schema;

  const next = {};
  for (const [key, value] of Object.entries(schema)) {
    const converted = convertKeyword(key, value);
    if (converted === UNEXPRESSIBLE) return UNEXPRESSIBLE;
    if (converted !== SKIP) next[key] = converted;
  }
  return closeObject(next);
}

/**
 * The schema as structured outputs accepts it, or null when it cannot be
 * expressed there — an open map (`additionalProperties` other than false).
 *
 * Walked by structure, not by key name: a property may well be called
 * `minLength`.
 */
function toStructuredOutputSchema(schema) {
  const converted = convertSchema(schema);
  return converted === UNEXPRESSIBLE ? null : converted;
}

function jsonTool(inputSchema) {
  return {
    name: JSON_TOOL_NAME,
    description: 'Emit the JSON object required by the output contract.',
    input_schema: inputSchema,
  };
}

/**
 * The JSON-mode fields of a request body.
 *
 * @param {Object} [schema] the output JSON Schema, when the caller has one
 * @returns {Object} fields to merge into the body
 */
function buildJsonModeFields(schema) {
  const objectSchema = isPlainObject(schema) && schema.type === 'object';
  const structured = objectSchema ? toStructuredOutputSchema(schema) : null;
  if (structured) {
    return {
      output_config: { format: { type: 'json_schema', schema: structured } },
    };
  }

  // No usable schema: structured outputs needs one, so only the tool is
  // left. Anthropic requires an object at the top of an input schema; any
  // other shape would be a 400 on every call, hence the open object.
  return {
    tools: [jsonTool(objectSchema ? schema : { type: 'object' })],
    tool_choice: { type: 'tool', name: JSON_TOOL_NAME },
  };
}

/** @returns {{param: string, action: string}|null} */
function detectJsonModeQuirk(status, parsedError, message) {
  if (status !== 400) return null;
  const error = parsedError?.error || {};
  const text = error.message || message || '';

  if (FORCED_TOOL_REFUSED.test(text)) {
    return { param: 'tool_choice', action: ADAPTATIONS.tool_choice };
  }
  if (OUTPUT_CONFIG_REFUSED.test(text)) {
    return { param: 'output_config', action: ADAPTATIONS.output_config };
  }
  return null;
}

function appendSystem(system, instruction) {
  return system ? `${system}\n\n${instruction}` : instruction;
}

/** Never mutates its input, like applyQuirks. */
function applyJsonModeQuirk(body, quirk) {
  if (quirk.action === ADAPTATIONS.output_config && body.output_config) {
    const { output_config: outputConfig, ...rest } = body;
    return {
      ...rest,
      tools: [jsonTool(outputConfig.format.schema)],
      tool_choice: { type: 'tool', name: JSON_TOOL_NAME },
    };
  }
  if (
    quirk.action === ADAPTATIONS.tool_choice &&
    body.tool_choice &&
    body.tool_choice.type !== 'auto'
  ) {
    return {
      ...body,
      tool_choice: { type: 'auto' },
      system: appendSystem(body.system, AUTO_TOOL_INSTRUCTION),
    };
  }
  return body;
}

/**
 * Apply learned quirks in the order they were learned: a model refusing both
 * routes first loses `output_config` for the tool, then the forced choice.
 */
function applyAnthropicQuirks(body, quirks) {
  return (quirks || []).reduce(
    (current, quirk) =>
      Object.values(ADAPTATIONS).includes(quirk.action)
        ? applyJsonModeQuirk(current, quirk)
        : applyQuirks(current, [quirk]),
    body
  );
}

/** The schema the request asked for, whichever route carried it. */
function requestedSchema(requestBody) {
  if (!requestBody) return null;
  const { output_config: outputConfig, tools } = requestBody;
  if (outputConfig?.format) return outputConfig.format.schema;
  const tool = (tools || []).find((item) => item.name === JSON_TOOL_NAME);
  return tool ? tool.input_schema : null;
}

/**
 * Undo an envelope the model invented: `{"paramètre": {"proposals": […]}}`
 * for `{"proposals": […]}`. claude-opus-5 did it in 12 calls out of 21 under
 * the forced tool, with a different key each time, so the key cannot be
 * listed — the shape is what is recognised.
 *
 * Only when nothing else fits: one top-level key, unknown to the schema,
 * holding an object (or the JSON text of one) made only of the schema's
 * properties and carrying all of its required ones. Anything else is handed
 * back untouched, for the zod schema to judge.
 *
 * @returns {{value: Object, envelope?: string}}
 */
function unwrapEnvelope(value, schema) {
  const untouched = { value };
  if (!isPlainObject(value) || !schema || !isPlainObject(schema.properties)) {
    return untouched;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || Object.hasOwn(schema.properties, keys[0]))
    return untouched;

  let inner = value[keys[0]];
  if (typeof inner === 'string') {
    try {
      inner = JSON.parse(inner);
    } catch {
      return untouched;
    }
  }
  if (!isPlainObject(inner)) return untouched;

  const fits =
    Object.keys(inner).every((key) => Object.hasOwn(schema.properties, key)) &&
    (schema.required || []).every((key) => Object.hasOwn(inner, key));
  return fits ? { value: inner, envelope: keys[0] } : untouched;
}

module.exports = {
  JSON_TOOL_NAME,
  AUTO_TOOL_INSTRUCTION,
  buildJsonModeFields,
  detectJsonModeQuirk,
  applyAnthropicQuirks,
  requestedSchema,
  unwrapEnvelope,
  toStructuredOutputSchema,
};

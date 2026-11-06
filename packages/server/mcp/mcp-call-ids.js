'use strict';

const { z } = require('zod');

// What the log keeps of what was asked: ids, never the rest of what was
// typed, each bounded, and a few of them.
const ID_KEY = /^(id|uri)$|Ids?$/;
const MAX_IDS = 20;
const MAX_ID_LENGTH = 200;
const MAX_NAME_LENGTH = 500;
// How deep, and over how many values, the arguments are read for their ids.
const MAX_DEPTH = 4;
const MAX_VISITS = 1000;

// A string cut at `max` characters; anything else is none.
const cut = (value, max) =>
  typeof value === 'string' ? value.slice(0, max) : null;

/**
 * The ids a tool declares, read from its input schema: an argument whose name
 * says it is an id (`id`, `uri`, `…Id`, `…Ids`), a string or a list of
 * strings, at any depth.
 *
 * @param {Object} schema the JSON schema of the tool's input
 * @returns {Object|true|null} the paths of its ids, as a tree whose leaves
 *   are `true`; null when it declares none
 */
function idPathsOf(schema, depth = 0) {
  if (!schema || depth > MAX_DEPTH) return null;
  if (schema.type === 'array') return idPathsOf(schema.items, depth + 1);
  if (schema.type !== 'object' || !schema.properties) return null;
  const tree = {};
  Object.entries(schema.properties).forEach(([name, property]) => {
    const item = property.type === 'array' ? property.items : property;
    if (ID_KEY.test(name) && item && item.type === 'string') {
      tree[name] = true;
      return;
    }
    const nested = idPathsOf(property, depth + 1);
    if (nested) tree[name] = nested;
  });
  return Object.keys(tree).length ? tree : null;
}

// The ids each input schema declares, read once: the server is built for
// every request, its tools registered again with the same schemas.
const declaredBySchema = new WeakMap();

function readDeclaredIds(inputSchema) {
  try {
    return idPathsOf(z.toJSONSchema(inputSchema, { io: 'input' }));
  } catch (err) {
    // A schema JSON cannot describe declares no id the log could keep.
    return null;
  }
}

function declaredIdsOf(inputSchema) {
  if (!inputSchema || typeof inputSchema !== 'object') return null;
  if (!declaredBySchema.has(inputSchema)) {
    declaredBySchema.set(inputSchema, readDeclaredIds(inputSchema));
  }
  return declaredBySchema.get(inputSchema);
}

// The ids found along the declared paths, until MAX_IDS of them, reading at
// most MAX_VISITS values: what was typed beside them is never read.
function idsAlong(value, paths) {
  const ids = [];
  let visits = 0;
  const walk = (node, tree, depth) => {
    visits += 1;
    if (ids.length >= MAX_IDS || visits > MAX_VISITS || depth > MAX_DEPTH) {
      return;
    }
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (ids.length >= MAX_IDS || visits > MAX_VISITS) return;
        walk(item, tree, depth + 1);
      }
      return;
    }
    if (tree === true) {
      if (typeof node === 'string') ids.push(cut(node, MAX_ID_LENGTH));
      return;
    }
    if (typeof node !== 'object') return;
    Object.entries(tree).forEach(([name, subtree]) =>
      walk(node[name], subtree, depth + 1)
    );
  };
  if (paths) walk(value, paths, 0);
  return ids.filter(Boolean);
}

// What a call asked for, as the log keeps it: the tool or the prompt, and the
// ids it was given, those its tool declares only.
function whatWasAsked(method, params = {}, declared) {
  const name = cut(params.name, MAX_NAME_LENGTH);
  if (method === 'tools/call') {
    return {
      name,
      objectIds: idsAlong(params.arguments, declared.get(params.name)),
    };
  }
  if (method === 'prompts/get') return { name, objectIds: [] };
  if (method === 'resources/read') {
    const uri = cut(params.uri, MAX_NAME_LENGTH);
    return { objectIds: uri ? [uri] : [] };
  }
  return { objectIds: [] };
}

module.exports = { declaredIdsOf, whatWasAsked, cut, MAX_NAME_LENGTH };

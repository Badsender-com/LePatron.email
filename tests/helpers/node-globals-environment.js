'use strict';

/**
 * Jest's node environment, with the globals of the Node that runs it.
 *
 * Jest 27 builds each test file's global object from a fixed list that
 * predates web streams, `structuredClone` and `fetch`; the MCP SDK uses them,
 * as Node 24 provides them to the app. This environment copies the ones the
 * sandbox lacks from the real global, so a test sees what the server sees.
 * Chosen per file with a docblock:
 *
 *   @jest-environment ./tests/helpers/node-globals-environment.js
 *
 * Gone with a Jest whose node environment follows Node's globals (28+).
 */

const NodeEnvironment = require('jest-environment-node');

const FROM_NODE = [
  'AbortController',
  'AbortSignal',
  'Blob',
  'BroadcastChannel',
  'DOMException',
  'Event',
  'EventTarget',
  'FormData',
  'Headers',
  'MessageChannel',
  'ReadableStream',
  'Request',
  'Response',
  'TextDecoderStream',
  'TextEncoderStream',
  'TransformStream',
  'WritableStream',
  'crypto',
  'fetch',
  'structuredClone',
];

class NodeGlobalsEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    FROM_NODE.forEach((name) => {
      if (this.global[name] === undefined && globalThis[name] !== undefined) {
        this.global[name] = globalThis[name];
      }
    });
  }
}

module.exports = NodeGlobalsEnvironment;

'use strict';

const logger = require('../utils/logger.js');

const SSE_FORMAT_ERROR = Symbol(`SSE_FORMAT_ERROR`);
const SSE_CONNECTION_CLOSED = Symbol(`SSE_CONNECTION_CLOSED`);

function createConnectionStatusPromise() {
  let res;
  const promise = new Promise((resolve) => {
    res = resolve;
  });
  promise.resolve = () => res(SSE_CONNECTION_CLOSED);
  return promise;
}

async function formatResponseForSSE(data) {
  try {
    const stringifiedData = JSON.stringify(data);
    return `data: ${stringifiedData}\n\n`;
  } catch (error) {
    logger.error(`unable to stringify data for SSE`);
    logger.error(error);
    return SSE_FORMAT_ERROR;
  }
}

const isRequired = () => {
  throw new Error(`isConnectionClosed param is required for SSE events`);
};

async function writeSSEResponse(res, data, isConnectionClosed = isRequired()) {
  const formatedData = await Promise.race([
    formatResponseForSSE(data),
    isConnectionClosed,
  ]);
  if (formatedData === SSE_FORMAT_ERROR) return;
  // because we might have an async callback fired
  // the request can be closed during the async operation
  // in that case we don't want to do anything that can break the app
  // • this should resolve `Error [ERRSTREAM_WRITE_AFTER_END]: write after end`
  if (formatedData === SSE_CONNECTION_CLOSED) return;
  // we're never too sure
  if (!formatedData) return;
  res.write(formatedData);
  // Flush to enable compression on SSE
  // https://github.com/expressjs/compression#server-sent-events
  // https://www.npmjs.com/package/compression#server-sent-events
  res.flush();
}

const safeEventsHandler = (asyncCallback) => async (data) => {
  try {
    await asyncCallback(data);
  } catch (error) {
    logger.error(`an error as occurred in some prevision events callback`);
    logger.error(error);
  }
};

module.exports = {
  createConnectionStatusPromise,
  writeResponse: writeSSEResponse,
  safeEventsHandler,
};

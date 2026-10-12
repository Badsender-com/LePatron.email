'use strict';

/**
 * A hard cap on what a run spends.
 *
 * The plan counts one call per probe and sample, but a probe can send many
 * more: transient retries, adaptation replays, a translation split into
 * batches — up to nine times the estimate. Since this is real money on real
 * keys, the cap is enforced where requests leave, not where they are planned.
 *
 * Wraps `_attemptChatCompletion` on the prototype rather than on an instance:
 * the translation probe builds its own provider per model, and every provider
 * inherits that method from BaseLLMProvider without overriding it. Listing and
 * credential checks do not go through it — they are not billed.
 */

const CALL_CAP_REACHED = 'CALL_CAP_REACHED';

/**
 * @param {Function} BaseClass class whose prototype carries the attempt
 * @param {number} maxCalls
 * @returns {{calls: number, restore: Function}}
 */
function meterChatCalls(BaseClass, maxCalls) {
  const original = BaseClass.prototype._attemptChatCompletion;
  const meter = { calls: 0 };

  BaseClass.prototype._attemptChatCompletion = function metered(...args) {
    if (meter.calls >= maxCalls) {
      const error = new Error(`call cap reached (--max-calls=${maxCalls})`);
      error.code = CALL_CAP_REACHED;
      return Promise.reject(error);
    }
    meter.calls += 1;
    return original.apply(this, args);
  };

  meter.restore = () => {
    BaseClass.prototype._attemptChatCompletion = original;
  };
  return meter;
}

function isCapReached(error) {
  return Boolean(error && error.code === CALL_CAP_REACHED);
}

module.exports = { meterChatCalls, isCapReached, CALL_CAP_REACHED };

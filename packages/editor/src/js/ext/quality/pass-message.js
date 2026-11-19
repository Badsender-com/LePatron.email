'use strict';

/**
 * What a passed check says ("Exported HTML weighs 12 KB"): the rule's
 * `passKey`, or the one it picks for this email (`passKeyOf`, the image
 * formats saying which images it did not judge), with its `passParams`. A
 * rule that cannot tell leaves the check passed, saying its plain `passKey`.
 * @param {Object} rule
 * @param {Object} ctx
 * @returns {{ passKey: string, passParams: Object }}
 */
function passMessageOf(rule, ctx) {
  try {
    return {
      passKey: (rule.passKeyOf && rule.passKeyOf(ctx)) || rule.passKey,
      passParams: (rule.passParams && rule.passParams(ctx)) || {},
    };
  } catch (err) {
    console.error(
      `Quality check "${rule.id}" could not describe its pass`,
      err
    );
    return { passKey: rule.passKey, passParams: {} };
  }
}

module.exports = { passMessageOf };

'use strict';

const { Groups } = require('../common/models.common.js');

// The company's switches: two-factor authentication for every member (ADR
// 0008) and MCP access (ADR 0012). Each one switched is a security event.
const SWITCHES = Object.freeze(['requireTwoFactor', 'enableMcp']);

/**
 * Takes the company's switches out of a group update, each a strict boolean:
 * true only when the request says `true`, since a string, a number or an
 * object would otherwise be cast by Mongoose, `'yes'` turning it on.
 *
 * @param {Object} payload the update, changed in place
 * @returns {Object} the switches it carried, by field
 */
function takeSwitches(payload) {
  const switches = {};
  SWITCHES.forEach((field) => {
    if (!(field in payload)) return;
    switches[field] = payload[field] === true;
    delete payload[field];
  });
  return switches;
}

/**
 * Writes the switches and reads what they were in one operation, on their
 * fields only, so the change it tells is the one this write made.
 *
 * @param {string} groupId
 * @param {Object} switches from takeSwitches
 * @returns {Promise<Object>} the switches this write changed, by field, with
 *   their new value; none when the group does not exist
 */
async function writeSwitches(groupId, switches) {
  const fields = Object.keys(switches);
  if (!fields.length) return {};
  const before = await Groups.findOneAndUpdate(
    { _id: groupId },
    { $set: switches },
    { new: false, projection: Object.fromEntries(fields.map((f) => [f, 1])) }
  ).lean();
  if (!before) return {};
  return Object.fromEntries(
    fields
      .filter((field) => Boolean(before[field]) !== switches[field])
      .map((field) => [field, switches[field]])
  );
}

module.exports = { SWITCHES, takeSwitches, writeSwitches };

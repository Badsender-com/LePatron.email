'use strict';

const { Groups } = require('../common/models.common.js');
const { recordRequirementChange } = require('../two-factor/group-option.js');
const {
  recordMcpAccessChange,
  recordRetexChange,
  forgetRetex,
} = require('../mcp/mcp-access-option.js');
const { revokeConnections } = require('../mcp/mcp-connections.js');

// The company's switches: two-factor authentication for every member (ADR
// 0008), MCP access and the retex of its assistants' sessions (ADR 0012).
// Each one switched is a security event.
const SWITCHES = Object.freeze(['requireTwoFactor', 'enableMcp', 'allowRetex']);

// The security event each switch records, by field.
const RECORDERS = Object.freeze({
  requireTwoFactor: recordRequirementChange,
  enableMcp: recordMcpAccessChange,
  allowRetex: recordRetexChange,
});

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

/**
 * Records a security event for each switch a write changed, and for it only,
 * in the order of the switches.
 *
 * @param {Object} actor the request user
 * @param {string} groupId
 * @param {Object} switched from writeSwitches
 * @returns {Promise<void>}
 */
async function recordSwitches(actor, groupId, switched) {
  for (const field of SWITCHES) {
    // eslint-disable-next-line no-await-in-loop
    await RECORDERS[field](actor, groupId, switched[field]);
  }
}

/**
 * What a switch takes with it when a request says it is off, whenever it
 * says so: the security event records a change only, and a forgetting that
 * failed can be run again (ADR 0012). The retex stopped forgets what it let
 * the feedbacks keep; MCP access turned off ends the company's connected
 * applications, so turning it back on revives none of them.
 *
 * @param {string} groupId
 * @param {Object} switches from takeSwitches
 * @returns {Promise<void>}
 */
async function forgetSwitchedOff(groupId, switches) {
  if (switches.allowRetex === false) await forgetRetex(groupId);
  if (switches.enableMcp === false) {
    await revokeConnections({ _company: groupId });
  }
}

module.exports = {
  takeSwitches,
  writeSwitches,
  recordSwitches,
  forgetSwitchedOff,
};

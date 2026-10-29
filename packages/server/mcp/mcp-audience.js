'use strict';

const { Audiences } = require('../ai-skill/constant/skill-constants.js');

/**
 * What of the skills and expertises a group reads (ADR 0013): everything for
 * the platform group, the Badsender team; for any other group, everything but
 * what is meant for the platform group. A skill or an expertise stored before
 * audiences existed carries none, and counts as opened to every group.
 *
 * @param {Object} group the group the call reads, as resolveIdentity gives it
 * @returns {Object} a filter to add to a query on skills or expertises
 */
function audienceFilter(group) {
  if (group && group.isPlatform === true) return {};
  return { audience: { $ne: Audiences.PLATFORM } };
}

module.exports = { audienceFilter };

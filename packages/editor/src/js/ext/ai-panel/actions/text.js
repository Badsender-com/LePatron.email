'use strict';

// An empty field is no context for a skill.
const orUndefined = (text) => (text && text.trim() ? text : undefined);

module.exports = { orUndefined };

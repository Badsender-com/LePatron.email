'use strict';

// What the server and the back office both read of skills and expertises
// (ADR 0013), defined once.

// What a skill is: a feature skill is a function a LePatron feature calls
// (template, schemas, output contract); a task skill is a procedure written
// for an assistant, with the expertises it consumes, in order. The nature
// belongs to the version, a feature one unless it says otherwise.
const SKILL_NATURES = Object.freeze({
  FEATURE: 'feature',
  TASK: 'task',
});
const SKILL_NATURE_VALUES = Object.freeze(Object.values(SKILL_NATURES));

// Who may use a skill or an expertise, in the editor as through an
// assistant: the platform company only, where a first draft is proven, or
// every company. A new one starts with the platform company, listed first.
const AUDIENCES = Object.freeze({
  PLATFORM: 'platform',
  ALL: 'all',
});
const AUDIENCE_VALUES = Object.freeze(Object.values(AUDIENCES));

// The expertises a task skill's version consumes, at most: an assistant
// reads them all before following the procedure.
const MAX_CONSUMED_EXPERTISES = 20;

module.exports = {
  SKILL_NATURES,
  SKILL_NATURE_VALUES,
  AUDIENCES,
  AUDIENCE_VALUES,
  MAX_CONSUMED_EXPERTISES,
};

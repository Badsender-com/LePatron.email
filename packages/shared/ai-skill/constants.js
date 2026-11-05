'use strict';

// What the server and the back office both read of skills and expertises
// (ADR 0013), defined once.
//
// No syntax that needs a Babel helper here (spread, classes, `for...of`): the
// UI's build compiles this file, and an injected helper import would turn it
// into a module that can no longer use `module.exports`.

// Where a skill, an expertise or one of their versions stands: a draft is
// edited, the active one is served, an archived one is kept for the record.
const STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
});
const STATUS_VALUES = Object.freeze(Object.values(STATUSES));

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

// What a search of the expertise list may be, at most: a title or an id,
// never a page of text.
const EXPERTISE_SEARCH_MAX_LENGTH = 100;

module.exports = {
  STATUSES,
  STATUS_VALUES,
  SKILL_NATURES,
  SKILL_NATURE_VALUES,
  AUDIENCES,
  AUDIENCE_VALUES,
  MAX_CONSUMED_EXPERTISES,
  EXPERTISE_SEARCH_MAX_LENGTH,
};

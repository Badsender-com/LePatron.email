'use strict';

// What the server and the taxonomy screen both read of the taxonomy (ADR 0032),
// defined once: each side kept its own copy, and two copies of a rule are one
// chance to disagree.
//
// No syntax that needs a Babel helper here (spread, classes, `for...of`): the
// UI's build compiles this file, and an injected helper import would turn it
// into a module that can no longer use `module.exports`.

// The two standard dimensions: the doctrine defines them, so every company has
// them and none can deactivate or delete them. Listed in the order the screen
// shows them.
const STANDARD_DIMENSIONS = Object.freeze({
  EMAIL_TYPE: 'emailType',
  TRIGGER: 'trigger',
});
const STANDARD_DIMENSION_NAMES = Object.freeze([
  STANDARD_DIMENSIONS.EMAIL_TYPE,
  STANDARD_DIMENSIONS.TRIGGER,
]);

// The trigger's two values, the doctrine's: a company neither renames them nor
// adds a third, so they are never taxonomy items.
const EMAIL_TRIGGERS = Object.freeze({
  // A send the team decided on, this once.
  AD_HOC: 'adhoc',
  // A send a rule decides, every time.
  AUTOMATED: 'automated',
});
const EMAIL_TRIGGER_VALUES = Object.freeze([
  EMAIL_TRIGGERS.AD_HOC,
  EMAIL_TRIGGERS.AUTOMATED,
]);

// A dimension's name is what a template reads (ADR-0015), so it accepts exactly
// what a template property name accepts. Capitals are allowed: `emailType` is
// one of the two standard dimensions.
const DIMENSION_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

// The names every JavaScript object already answers to, through
// Object.prototype, plus `prototype`. The editor keys an email's values by
// dimension name. Under `__proto__` a chosen value is not stored but sets the
// object's prototype, lost without a word. Under the others it is stored, but
// an email that has no value for that dimension reads back the inherited
// function instead of nothing: `{}.toString` is a function, and once a value
// sits there, `{ hasOwnProperty: 'ca' }.hasOwnProperty(x)` throws.
//
// Listed rather than read from Object.prototype at run time, so the server and
// the browser refuse the same names whatever their engine adds; a test checks
// the list still covers Object.prototype. A template option's name (`country`,
// `bodyWidth`) stays allowed: a dimension may fill one in.
const RESERVED_DIMENSION_NAMES = Object.freeze([
  '__proto__',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
  'prototype',
]);

// Bounds of the editable fields, read by the Mongoose schemas, the services and
// the forms.
const TAXONOMY_LIMITS = Object.freeze({
  LABEL: 120,
  DESCRIPTION: 2000,
  // A value's identifier, what a template compares against.
  CANONICAL_TYPE: 60,
  // A dimension's name, what a template reads as a property: its own bound,
  // not the identifier's, though both happen to be 60 today.
  DIMENSION_NAME: 60,
  // A company describing its own editorial vocabulary needs tens of values per
  // dimension, not thousands. Bounds both the unpaginated read and the storage.
  // Counted per dimension: a full dimension leaves the others open.
  VALUES_PER_DIMENSION: 200,
  // A company declines its emails by a handful of axes, not a hundred. The
  // standard dimensions count.
  DIMENSIONS_PER_COMPANY: 20,
});

module.exports = {
  STANDARD_DIMENSIONS,
  STANDARD_DIMENSION_NAMES,
  EMAIL_TRIGGERS,
  EMAIL_TRIGGER_VALUES,
  DIMENSION_NAME_PATTERN,
  RESERVED_DIMENSION_NAMES,
  TAXONOMY_LIMITS,
};

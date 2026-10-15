import isEqual from 'lodash/isEqual';
import { CHECKS, SERVER_CHECKS } from '~/helpers/constants/quality-checks.js';

// The "Contrôle qualité" page shows exceptions only
// (docs/adr/0004-quality-settings-per-group-and-template.md). Three levels:
//   - the recommended values: the catalogue's, they cannot be set;
//   - the general settings: a group's exceptions, for all its templates;
//   - a template's exceptions: over the general settings, for it alone.
// An exception is one entry of the API's `checks`: `{ state, thresholds }`,
// `null` (or an empty field) where it sets nothing and the level below
// applies.

export const GENERAL = 'general';
export const TEMPLATE = 'template';

const own = (object, key) =>
  Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
const isSet = (value) => value !== null && value !== undefined && value !== '';
const toNumber = (value) => (isSet(value) ? Number(value) : null);
const thresholdNames = (id) => Object.keys(CHECKS[id].thresholds);
const storedChecks = (settings) =>
  settings && settings.checks && typeof settings.checks === 'object'
    ? settings.checks
    : {};

export const isServerCheck = (id) => SERVER_CHECKS.includes(id);

// The checks whose card carries a note: a setting elsewhere it depends on.
const NOTE_CHECKS = [
  'tracking-params',
  'domain-blocklists',
  'dangerous-links',
  'color-contrast',
];
export const hasNote = (id) => NOTE_CHECKS.includes(id);

/** The catalogue's values of a check: what applies when nothing is set. */
export function recommendedOf(id) {
  const { defaultState, thresholds } = CHECKS[id];
  return {
    state: defaultState,
    thresholds: Object.fromEntries(
      Object.entries(thresholds).map(([name, t]) => [name, t.default])
    ),
  };
}

/** A new exception: nothing set yet, so it changes nothing. */
export function emptyException(id) {
  return {
    state: null,
    thresholds: Object.fromEntries(thresholdNames(id).map((n) => [n, null])),
  };
}

export function isEmptyException(exception) {
  return (
    !exception ||
    (!isSet(exception.state) &&
      Object.values(exception.thresholds || {}).every((v) => !isSet(v)))
  );
}

/**
 * The exceptions stored at one level, check by check: catalogue checks only,
 * and only those where something is set.
 * @param {Object} [settings] a group's or a template's `qualitySettings`
 * @returns {Object<string, { state: string|null, thresholds: Object }>}
 */
export function exceptionsOf(settings) {
  const stored = storedChecks(settings);
  return Object.fromEntries(
    Object.keys(stored)
      .filter((id) => own(CHECKS, id) && stored[id])
      .map((id) => {
        const thresholds = stored[id].thresholds || {};
        return [
          id,
          {
            state: stored[id].state || null,
            thresholds: Object.fromEntries(
              thresholdNames(id).map((name) => [
                name,
                own(thresholds, name) && Number.isFinite(thresholds[name])
                  ? thresholds[name]
                  : null,
              ])
            ),
          },
        ];
      })
      .filter(([, exception]) => !isEmptyException(exception))
  );
}

/** How many checks a level has an exception on. */
export function exceptionCount(settings) {
  return Object.keys(exceptionsOf(settings)).length;
}

/** What an exception applies: its own values, the base's for the rest. */
export function effectiveOf(exception, base) {
  const ex = exception || {};
  const thresholds = ex.thresholds || {};
  return {
    state: isSet(ex.state) ? ex.state : base.state,
    thresholds: Object.fromEntries(
      Object.entries(base.thresholds).map(([name, value]) => [
        name,
        isSet(thresholds[name]) ? Number(thresholds[name]) : value,
      ])
    ),
  };
}

/**
 * What applies to every template: the general settings over the recommended
 * values, for all the checks.
 * @param {Object} [groupSettings] the group's `qualitySettings`
 */
export function generalOf(groupSettings) {
  const exceptions = exceptionsOf(groupSettings);
  return Object.fromEntries(
    Object.keys(CHECKS).map((id) => [
      id,
      effectiveOf(exceptions[id], recommendedOf(id)),
    ])
  );
}

/**
 * Whether two exceptions set the same values, an empty field and `null`
 * alike: what the card compares to tell an unsaved change.
 */
export function sameException(a, b) {
  const values = (ex) =>
    ex
      ? {
          state: isSet(ex.state) ? ex.state : null,
          thresholds: Object.fromEntries(
            Object.entries(ex.thresholds || {}).map(([name, value]) => [
              name,
              toNumber(value),
            ])
          ),
        }
      : null;
  return isEqual(values(a), values(b));
}

/** Whether every value an exception sets equals the one it replaces. */
export function matchesBase(exception, base) {
  const ex = exception || {};
  if (isSet(ex.state) && ex.state !== base.state) return false;
  return Object.entries(ex.thresholds || {}).every(
    ([name, value]) => !isSet(value) || Number(value) === base.thresholds[name]
  );
}

// The exception as it is saved. In the general settings, a value equal to the
// recommended one sets nothing. On a template, a value equal to the general
// one is kept: it will not follow the general settings' later changes.
function normalized(level, id, exception) {
  const recommended = recommendedOf(id);
  const ex = exception || {};
  const thresholds = ex.thresholds || {};
  const keep = (value, recommendedValue) =>
    level === GENERAL && value === recommendedValue ? null : value;
  return {
    state: keep(isSet(ex.state) ? ex.state : null, recommended.state),
    thresholds: Object.fromEntries(
      thresholdNames(id).map((name) => [
        name,
        keep(toNumber(thresholds[name]), recommended.thresholds[name]),
      ])
    ),
  };
}

/**
 * The payload that saves a level: only the checks that changed since
 * `saved`, so two admins editing different checks do not overwrite each
 * other. An exception left out, or with nothing set any more, is removed.
 * @param {string} level GENERAL or TEMPLATE
 * @param {Object} drafts the exceptions as edited, by check
 * @param {Object} saved the exceptions as stored, by check
 * @returns {{ checks: Object }}
 */
export function exceptionsPayload(level, drafts, saved) {
  const ids = new Set(Object.keys(drafts).concat(Object.keys(saved)));
  const checks = {};
  ids.forEach((id) => {
    // Removed (the trash), whatever it held: values equal to the
    // recommended ones still have to leave the stored settings.
    if (saved[id] && !drafts[id]) {
      checks[id] = { state: null, thresholds: null };
      return;
    }
    const next = normalized(level, id, drafts[id]);
    const previous = normalized(level, id, saved[id]);
    if (isEqual(next, previous)) return;
    if (isEmptyException(next)) {
      checks[id] = { state: null, thresholds: null };
      return;
    }
    const anyThreshold = Object.values(next.thresholds).some(isSet);
    checks[id] = {
      state: next.state,
      thresholds: anyThreshold ? next.thresholds : null,
    };
  });
  return { checks };
}

/**
 * The errors of an exception's thresholds, by name: a value outside its
 * bounds, or a pair out of order. A pair is compared on what applies (the
 * exception's value, else the base's), and its error goes on the field
 * edited last, else on the higher level.
 * @returns {Object<string, { key: string, params: Object }>}
 */
export function fieldErrors(id, exception, base, lastEdited = null) {
  const thresholds = (exception && exception.thresholds) || {};
  const errors = {};
  thresholdNames(id).forEach((name) => {
    if (!isSet(thresholds[name])) return;
    const value = Number(thresholds[name]);
    const { min, max } = CHECKS[id].thresholds[name];
    if (!Number.isFinite(value) || value < min || value > max) {
      errors[name] = {
        key: 'qualitySettings.thresholdError',
        params: { min, max },
      };
    }
  });
  const applied = effectiveOf(exception, base).thresholds;
  (CHECKS[id].ordered || []).forEach(([low, high]) => {
    if (errors[low] || errors[high] || applied[low] <= applied[high]) return;
    const owned = [low, high].filter((name) => isSet(thresholds[name]));
    if (!owned.length) return;
    let target = low;
    if (owned.includes(lastEdited)) target = lastEdited;
    else if (owned.includes(high)) target = high;
    errors[target] =
      target === high
        ? { key: 'qualitySettings.orderError', params: { value: applied[low] } }
        : {
            key: 'qualitySettings.orderErrorHigh',
            params: { value: applied[high] },
          };
  });
  return errors;
}

/**
 * Where a blocking check with a pair of levels starts to block: any of its
 * findings blocks, whatever its severity (ADR 0004), so from its lower level.
 * @returns {{ name: string, value: number }|null}
 */
export function blocksFrom(id, thresholds) {
  const [pair] = CHECKS[id].ordered || [];
  return pair ? { name: pair[0], value: thresholds[pair[0]] } : null;
}

/**
 * What an exception sets, in order: its state, then its thresholds.
 * @returns {Array<{ kind: 'state', state: string }|{ kind: 'threshold',
 *   name: string, value: number }>}
 */
export function exceptionParts(id, exception) {
  const ex = exception || {};
  const parts = isSet(ex.state) ? [{ kind: 'state', state: ex.state }] : [];
  thresholdNames(id).forEach((name) => {
    const value = toNumber((ex.thresholds || {})[name]);
    if (value !== null) parts.push({ kind: 'threshold', name, value });
  });
  return parts;
}

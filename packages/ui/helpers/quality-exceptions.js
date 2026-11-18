import isEqual from 'lodash/isEqual';
import { CHECKS, SERVER_CHECKS } from '~/helpers/constants/quality-checks.js';
import { templateThresholds } from '../../shared/quality/resolve-quality-settings.js';

// The "Contrôle qualité" page shows exceptions only
// (docs/adr/0009-quality-settings-per-group-and-template.md). Three levels:
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
// Whether a field sets a value: an empty field and null do not.
export const isSet = (value) =>
  value !== null && value !== undefined && value !== '';
export const toNumber = (value) => (isSet(value) ? Number(value) : null);
export const thresholdNames = (id) => Object.keys(CHECKS[id].thresholds);
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

// The thresholds an exception sets, as numbers: what the server would store.
function ownThresholds(exception) {
  const thresholds = (exception && exception.thresholds) || {};
  return Object.fromEntries(
    Object.entries(thresholds)
      .map(([name, value]) => [name, toNumber(value)])
      .filter(([, value]) => Number.isFinite(value))
  );
}

/**
 * What an exception applies: its own values, the base's for the rest. On a
 * template (`checkId` given), resolved as the server resolves it: its own
 * threshold wins over an inherited one it contradicts
 * (packages/shared/quality/resolve-quality-settings.js).
 * @param {Object} [exception]
 * @param {{ state: string, thresholds: Object }} base
 * @param {string} [checkId] a template's check
 */
export function effectiveOf(exception, base, checkId = null) {
  const ex = exception || {};
  const thresholds = ex.thresholds || {};
  return {
    state: isSet(ex.state) ? ex.state : base.state,
    thresholds: checkId
      ? templateThresholds(checkId, base.thresholds, ownThresholds(ex))
          .thresholds
      : Object.fromEntries(
          Object.entries(base.thresholds).map(([name, value]) => [
            name,
            isSet(thresholds[name]) ? Number(thresholds[name]) : value,
          ])
        ),
  };
}

/**
 * The inherited thresholds a template's exception brings to its own value,
 * so that the card can say so.
 * @returns {Array<{ threshold: string, inherited: number, value: number }>}
 */
export function adjustmentsOf(checkId, exception, base) {
  return templateThresholds(checkId, base.thresholds, ownThresholds(exception))
    .adjustments;
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
 * Exceptions as edited, in the shape of a level's stored settings: what the
 * page shows as applying before it is saved. Only valid numbers count.
 * @param {Object} drafts the exceptions as edited, by check
 * @returns {{ checks: Object }}
 */
export function settingsOfDrafts(drafts) {
  return {
    checks: Object.fromEntries(
      Object.keys(drafts).map((id) => [
        id,
        {
          state: isSet(drafts[id].state) ? drafts[id].state : null,
          thresholds: ownThresholds(drafts[id]),
        },
      ])
    ),
  };
}

/**
 * The templates an unsaved change of a general setting will not reach: those
 * that set their own value of what changed, or one the new general value
 * contradicts (their own wins, effectiveOf).
 * @param {string} id
 * @param {Object} drafted the general settings as edited (settingsOfDrafts)
 * @param {Object} saved the general settings as stored
 * @param {Object[]} templates the group's, with their `qualitySettings`
 * @returns {Object[]} those templates
 */
export function templatesKeepingOwn(id, drafted, saved, templates) {
  const before = generalOf(saved)[id];
  const after = generalOf(drafted)[id];
  const names = thresholdNames(id).filter(
    (name) => before.thresholds[name] !== after.thresholds[name]
  );
  const stateChanged = before.state !== after.state;
  if (!names.length && !stateChanged) return [];
  return templates.filter((template) => {
    const exception = exceptionsOf(template.qualitySettings)[id];
    if (!exception) return false;
    if (stateChanged && isSet(exception.state)) return true;
    if (names.some((name) => isSet(exception.thresholds[name]))) return true;
    return adjustmentsOf(id, exception, after).some((adjustment) =>
      names.includes(adjustment.threshold)
    );
  });
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

/**
 * The values an exception sets that equal the ones it replaces: on a
 * template, kept but no longer following the general settings.
 * @returns {string[]} 'state' and the names of the thresholds
 */
export function valuesEqualToBase(exception, base) {
  const ex = exception || {};
  const equal = isSet(ex.state) && ex.state === base.state ? ['state'] : [];
  Object.entries(ex.thresholds || {}).forEach(([name, value]) => {
    if (isSet(value) && Number(value) === base.thresholds[name]) {
      equal.push(name);
    }
  });
  return equal;
}

/**
 * Where a blocking check with a pair of levels starts to block: only its
 * most severe level blocks (ADR 0009), and the catalogue lists a pair lowest
 * first (`ordered`: an info then a warning, a warning then an error), so past
 * its higher threshold. Under it, a finding is shown and the export goes on.
 * @returns {{ name: string, value: number }|null}
 */
export function blocksFrom(id, thresholds) {
  const [pair] = CHECKS[id].ordered || [];
  return pair ? { name: pair[1], value: thresholds[pair[1]] } : null;
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

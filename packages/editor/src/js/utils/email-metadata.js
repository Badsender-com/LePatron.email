'use strict';

/**
 * Pure helpers for the editor's email-metadata panel.
 *
 * Everything the panel decides lives here rather than in the Vue component: the
 * editor has no component test harness, so anything left in the component is
 * untested. Covered by tests/editor/email-metadata.test.js.
 */

// Deliverability guidance, not validation: an out-of-range value is flagged, never
// refused. A subject that is too long is truncated by the mail client; too short
// and it says nothing.
const SUBJECT_RANGE = { min: 30, max: 50 };
// Mirrors MAX_SUBJECT_LENGTH in packages/server/mailing/mailing-metadata.service.js.
// The panel warns; the server refuses.
const SUBJECT_HARD_LIMIT = 255;

/**
 * State of a character counter, for a field whose length is advice rather than a
 * rule.
 *
 * @param {string} value
 * @param {{min: number, max: number}} range
 * @returns {{length: number, min: number, max: number, state: 'empty'|'short'|'ok'|'long'}}
 */
function counterState(value, range) {
  const length = String(value == null ? '' : value).length;
  let state = 'ok';

  if (length === 0) state = 'empty';
  else if (length < range.min) state = 'short';
  else if (length > range.max) state = 'long';

  return { length, min: range.min, max: range.max, state };
}

const subjectCounter = (value) => counterState(value, SUBJECT_RANGE);

/**
 * A Date, or the value the server sent, rendered for `<input type="date">`, which
 * only accepts `yyyy-mm-dd`.
 *
 * Uses the LOCAL date parts, not toISOString(): an evening send date in Paris is
 * the previous day in UTC, and the field would show the wrong day.
 *
 * @param {Date|string|null|undefined} value
 * @returns {string} '' when there is no usable date
 */
function toDateInputValue(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The value of a `<input type="date">` as the API expects it.
 *
 * Noon local time rather than midnight: a planned send date is a day, and
 * midnight in a negative-offset timezone lands on the day before once stored in
 * UTC.
 *
 * @param {string} value 'yyyy-mm-dd' or ''
 * @returns {string|null} an ISO string, or null to clear the field
 */
function fromDateInputValue(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    12,
    0,
    0,
    0
  );
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

/**
 * The PATCH payload for subject, planned send date and typology.
 *
 * `null` clears a field, and the server reads it that way.
 *
 * @param {Object} form { subject, plannedSendDate, emailTypeId }
 * @returns {Object}
 */
function buildMetadataPayload(form) {
  const subject = String(form.subject == null ? '' : form.subject).trim();

  return {
    subject: subject === '' ? null : subject,
    plannedSendDate: fromDateInputValue(form.plannedSendDate),
    _emailType: form.emailTypeId ? form.emailTypeId : null,
  };
}

/**
 * The form state the panel opens with, from what the server exposed.
 *
 * @param {Object} [emailMetadata] metadata.emailMetadata
 * @returns {{subject: string, plannedSendDate: string, emailTypeId: string}}
 */
function toFormState(emailMetadata) {
  const values = emailMetadata || {};

  return {
    subject: values.subject || '',
    plannedSendDate: toDateInputValue(values.plannedSendDate),
    emailTypeId: values.emailTypeId ? String(values.emailTypeId) : '',
  };
}

/**
 * Options for the typology select, with an explicit empty choice.
 *
 * An email may point at a typology that has since been deactivated: it is not in
 * the list, and dropping it silently would rewrite the email's typology on the
 * next save. It is added back, flagged, so the user sees what they have.
 *
 * @param {Array} emailTypes metadata.emailMetadataConfig.emailTypes
 * @param {string} [currentId] the typology the email points at
 * @param {string} noneLabel translated label for "no typology"
 * @param {string} [missingLabel] translated label for a deactivated typology;
 *   distinct from `noneLabel`, otherwise the select shows two identical options
 *   and the user cannot tell their email points at a withdrawn typology
 * @returns {Array<{value: string, text: string, missing?: boolean}>}
 */
function typologyOptions(emailTypes, currentId, noneLabel, missingLabel) {
  const options = (emailTypes || []).map((item) => ({
    value: String(item.id || item._id),
    text: item.label,
  }));

  if (currentId && !options.some((o) => o.value === String(currentId))) {
    options.push({
      value: String(currentId),
      text: missingLabel || noneLabel,
      missing: true,
    });
  }

  return [{ value: '', text: noneLabel }].concat(
    options.filter((o) => o.value !== '')
  );
}

/**
 * Whether anything the PATCH covers actually changed. A save that sends an
 * unchanged payload is a request for nothing.
 *
 * @param {Object} form current form state
 * @param {Object} initial state the panel opened with
 * @returns {boolean}
 */
function hasMetadataChanges(form, initial) {
  return (
    String(form.subject || '') !== String(initial.subject || '') ||
    String(form.plannedSendDate || '') !==
      String(initial.plannedSendDate || '') ||
    String(form.emailTypeId || '') !== String(initial.emailTypeId || '')
  );
}

module.exports = {
  SUBJECT_RANGE,
  SUBJECT_HARD_LIMIT,
  counterState,
  subjectCounter,
  toDateInputValue,
  fromDateInputValue,
  buildMetadataPayload,
  toFormState,
  typologyOptions,
  hasMetadataChanges,
};

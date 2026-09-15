'use strict';

/**
 * Pure helpers for the editor's email-metadata section.
 *
 * Everything the section decides lives here rather than in the Vue component: the
 * editor has no component test harness, so anything left in the component is
 * untested. Covered by tests/editor/email-metadata.test.js.
 */

// Mirrors MAX_SUBJECT_LENGTH in packages/server/mailing/mailing-metadata.service.js.
// The field stops there; the server refuses beyond it.
//
// There is deliberately no 30-50 character counter or recommendation any more:
// deliverability advice is not this field's job, and the counter was noise on a
// field the user fills once.
const SUBJECT_HARD_LIMIT = 255;

/**
 * A Date, or the value the server sent, rendered for `<input type="date">`, which
 * only accepts `yyyy-mm-dd`.
 *
 * Read in UTC, to match the way fromDateInputValue writes. A planned send date is
 * a calendar day, not an instant: it must read back as the same day for every
 * teammate, whatever their timezone. Local parts would make a date stored by a
 * colleague in Los Angeles show up shifted for one in Tokyo.
 *
 * @param {Date|string|null|undefined} value
 * @returns {string} '' when there is no usable date
 */
function toDateInputValue(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * The value of a `<input type="date">` as the API expects it.
 *
 * Noon UTC, not midnight and not noon local.
 *
 * The field carries a calendar day with no time, so the stored instant only has
 * to satisfy one property: every timezone must read the same day back. Noon UTC
 * does, for every offset from -11 to +12. Midnight UTC fails west of Greenwich
 * (23:00 the previous day in Paris terms is fine, but 16:00 the DAY BEFORE in Los
 * Angeles is not), and noon *local* — what this did before — fails between two
 * users: a date saved at noon in Los Angeles is 19:00Z, which is the next day in
 * Tokyo.
 *
 * @param {string} value 'yyyy-mm-dd' or ''
 * @returns {string|null} an ISO string, or null to clear the field
 */
function fromDateInputValue(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), 12);
  if (Number.isNaN(timestamp)) return null;

  return new Date(timestamp).toISOString();
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
    emailTypeId: form.emailTypeId ? form.emailTypeId : null,
  };
}

/**
 * The form state the section opens with, from what the server exposed.
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
 * @param {Object} initial state the section opened with
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

/**
 * A server error code mapped onto an i18n key.
 *
 * Lives here, not in the component, for the reason the file header gives: this is
 * the most breakable part of the save path — a typo in one of the four codes
 * degrades silently to the generic message — and the component is untested.
 *
 * A raw server message is never shown: it is a code, or an untranslated developer
 * sentence.
 *
 * @param {Error} error an axios error
 * @returns {string} an i18n key
 */
function errorKeyFor(error) {
  const code =
    (error &&
      error.response &&
      error.response.data &&
      error.response.data.message) ||
    null;

  switch (code) {
    case 'EMAIL_METADATA_DISABLED':
      return 'email-metadata-error-disabled';
    case 'EMAIL_TYPE_NOT_FOUND':
      return 'email-metadata-error-typology';
    case 'EMAIL_TYPE_COMPANY_MISSING':
      return 'email-metadata-error-no-company';
    case 'INVALID_EMAIL_METADATA':
      return 'email-metadata-error-invalid';
    default:
      return 'email-metadata-error';
  }
}

module.exports = {
  SUBJECT_HARD_LIMIT,
  errorKeyFor,
  toDateInputValue,
  fromDateInputValue,
  buildMetadataPayload,
  toFormState,
  typologyOptions,
  hasMetadataChanges,
};

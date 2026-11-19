'use strict';

/**
 * A feature skill's test cases (ADR 0019): what a case must hold, checked
 * before a draft is saved and when a skills file is read.
 *
 * The version model declares the same rule, but Mongoose only applies it at
 * save time, as a ValidationError the API answers with a 500. Checking it
 * first lets the person read which case is incomplete.
 */

const createError = require('http-errors');
const { z } = require('zod');
const ERROR_CODES = require('../../constant/error-codes.js');

const TEST_CASE = z.object({
  // The reason words the refusal of an imported file (skills-export.format.js).
  name: z.string().refine((value) => value.trim().length > 0, {
    message: 'Required',
    params: { reason: 'missing' },
  }),
  input: z.unknown().refine((value) => value !== undefined && value !== null, {
    message: 'Required',
    params: { reason: 'missing' },
  }),
  expectedOutput: z.unknown().optional(),
  notes: z.string().optional(),
});

const TEST_CASES = z.array(TEST_CASE);

/**
 * @param {unknown} testCases what a request gives as a version's test cases
 * @throws {HttpError} 400 `SKILL_TEST_CASE_INVALID`, with the `index` of the
 *   first incomplete case (and its `position`, from 1) and the `field` at fault
 */
function assertTestCases(testCases) {
  const result = TEST_CASES.safeParse(testCases);
  if (result.success) return;
  const [index, field] = result.error.issues[0].path;
  throw createError(400, ERROR_CODES.SKILL_TEST_CASE_INVALID, {
    index,
    position: Number.isInteger(index) ? index + 1 : undefined,
    field,
  });
}

module.exports = { TEST_CASE, assertTestCases };

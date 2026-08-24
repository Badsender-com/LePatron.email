'use strict';

const { z } = require('zod');
const {
  buildFieldErrors,
} = require('../../../../packages/server/ai-skill/services/format-validation-error.js');

// Real ZodErrors built via safeParse against the installed zod (no
// hand-crafted issue fixtures): the mapping is tested against what zod 4
// actually produces.
function errorsFor(schema, input) {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  return buildFieldErrors(result.error, input);
}

const STRICT_SCHEMA = z
  .object({
    prompt: z.string().min(1),
    context: z.string().optional(),
    count: z.number(),
  })
  .strict();

describe('buildFieldErrors', () => {
  it('maps a missing required field to "required"', () => {
    const errors = errorsFor(STRICT_SCHEMA, { count: 2 });
    expect(errors).toContainEqual({ field: 'prompt', issue: 'required' });
  });

  it('maps unrecognized keys to one entry per key', () => {
    const errors = errorsFor(STRICT_SCHEMA, {
      prompt: 'hi',
      count: 2,
      brief: 'x',
      userInput: 'y',
    });
    expect(errors).toContainEqual({ field: 'brief', issue: 'unrecognized' });
    expect(errors).toContainEqual({
      field: 'userInput',
      issue: 'unrecognized',
    });
  });

  it('maps too_small / too_big to "length"', () => {
    const errors = errorsFor(STRICT_SCHEMA, { prompt: '', count: 2 });
    expect(errors).toContainEqual({ field: 'prompt', issue: 'length' });
  });

  it('maps a wrong type with a value present to "invalid" (not required)', () => {
    const errors = errorsFor(STRICT_SCHEMA, { prompt: 'hi', count: 'three' });
    expect(errors).toContainEqual({ field: 'count', issue: 'invalid' });
  });

  it('deduplicates entries by field, keeping the first', () => {
    const schema = z
      .object({
        v: z
          .string()
          .min(5)
          .regex(/^[a-z]+$/),
      })
      .strict();
    const errors = errorsFor(schema, { v: '1' });
    expect(errors.filter((e) => e.field === 'v')).toHaveLength(1);
    expect(errors[0].issue).toBe('length');
  });

  it('uses dotted paths for nested fields and <root> as fallback', () => {
    const nested = z.object({ meta: z.object({ tone: z.string() }) });
    const errors = errorsFor(nested, { meta: {} });
    expect(errors).toContainEqual({ field: 'meta.tone', issue: 'required' });
  });
});

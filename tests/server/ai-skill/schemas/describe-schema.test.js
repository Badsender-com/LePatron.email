'use strict';

const { z } = require('zod');
const {
  describeSchema,
  describeField,
} = require('../../../../packages/server/ai-skill/schemas/describe-schema.js');

describe('describe-schema', () => {
  describe('describeSchema', () => {
    it('describes genericTextInput (registry source of truth)', () => {
      const d = describeSchema('genericTextInput');
      expect(d).toEqual({
        schemaId: 'genericTextInput',
        fields: [
          { name: 'prompt', type: 'string', required: true, multiline: true },
          { name: 'context', type: 'string', required: false, multiline: true },
        ],
        hasExpertiseField: true,
      });
    });

    it('excludes the expertise field from fields', () => {
      const d = describeSchema('genericTextInput');
      expect(d.fields.map((f) => f.name)).not.toContain('expertise');
    });

    it('returns null for an unknown schemaId', () => {
      expect(describeSchema('nope')).toBeNull();
    });
  });

  describe('describeField', () => {
    it('detects number, boolean, and default()/optional() as not required', () => {
      expect(describeField('n', z.number())).toEqual({
        name: 'n',
        type: 'number',
        required: true,
        multiline: false,
      });
      expect(describeField('b', z.boolean())).toEqual({
        name: 'b',
        type: 'boolean',
        required: true,
        multiline: false,
      });
      expect(describeField('d', z.number().default(3)).required).toBe(false);
      expect(describeField('o', z.string().optional()).required).toBe(false);
    });

    it('marks non-representable types as unknown without crashing', () => {
      expect(describeField('arr', z.array(z.string())).type).toBe('unknown');
      expect(describeField('e', z.enum(['a', 'b'])).type).toBe('unknown');
      expect(describeField('obj', z.object({ x: z.string() })).type).toBe(
        'unknown'
      );
      expect(describeField('u', z.union([z.string(), z.number()])).type).toBe(
        'unknown'
      );
    });

    it('unwraps nested wrappers (optional around default)', () => {
      const field = z.string().default('x').optional();
      const d = describeField('w', field);
      expect(d.type).toBe('string');
      expect(d.required).toBe(false);
      expect(d.multiline).toBe(true);
    });
  });
});

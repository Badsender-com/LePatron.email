'use strict';

const { Types } = require('mongoose');
const {
  scalarParam,
  enumParam,
  objectIdParam,
  dateParam,
  escapeRegex,
} = require('../../../packages/server/utils/query-scalars');

// Express parses `?status[$ne]=` into an object, so these guards are what
// stands between a query string and a Mongo operator.

describe('scalarParam', () => {
  it('passes scalars through as strings', () => {
    expect(scalarParam('abc', 'x')).toBe('abc');
    expect(scalarParam(12, 'x')).toBe('12');
  });

  it('treats absent and empty as no filter', () => {
    expect(scalarParam(undefined, 'x')).toBeUndefined();
    expect(scalarParam(null, 'x')).toBeUndefined();
    expect(scalarParam('', 'x')).toBeUndefined();
  });

  it('rejects an injected operator or array', () => {
    expect(() => scalarParam({ $ne: '' }, 'status')).toThrow(/status/);
    expect(() => scalarParam({ $regex: '.*' }, 'skillId')).toThrow(/skillId/);
    expect(() => scalarParam(['a', 'b'], 'tag')).toThrow(/tag/);
  });

  it('answers 400, not 500', () => {
    let status;
    try {
      scalarParam({ $ne: '' }, 'status');
    } catch (err) {
      status = err.status;
    }
    expect(status).toBe(400);
  });
});

describe('enumParam', () => {
  it('accepts a known value', () => {
    expect(enumParam('SUCCESS', 'status', ['SUCCESS', 'TIMEOUT'])).toBe(
      'SUCCESS'
    );
  });

  it('rejects an unknown value and an operator', () => {
    expect(() => enumParam('NOPE', 'status', ['SUCCESS'])).toThrow(/status/);
    expect(() => enumParam({ $ne: null }, 'status', ['SUCCESS'])).toThrow();
  });
});

describe('objectIdParam', () => {
  it('accepts a valid id string and an ObjectId instance', () => {
    const oid = new Types.ObjectId();
    expect(objectIdParam(oid.toString(), 'owner')).toBe(oid.toString());
    expect(objectIdParam(oid, 'owner')).toBe(oid);
  });

  it('rejects a malformed id rather than letting it become a CastError 500', () => {
    expect(() => objectIdParam('not-an-id', 'runId')).toThrow(/runId/);
  });
});

describe('dateParam', () => {
  it('parses a date', () => {
    expect(dateParam('2026-08-01', 'startedFrom')).toEqual(
      new Date('2026-08-01')
    );
  });

  it('rejects an unparseable date instead of querying on Invalid Date', () => {
    expect(() => dateParam('notadate', 'startedFrom')).toThrow(/startedFrom/);
  });
});

describe('escapeRegex', () => {
  it('neutralises regex metacharacters', () => {
    expect(escapeRegex('.*')).toBe('\\.\\*');
    expect(new RegExp(escapeRegex('a.b')).test('axb')).toBe(false);
    expect(new RegExp(escapeRegex('a.b')).test('a.b')).toBe(true);
  });
});

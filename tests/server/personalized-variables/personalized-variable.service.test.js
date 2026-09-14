'use strict';

// Tenant scoping of the personalized-variables service.
//
// The route guards (group.routes.js) only check that the caller belongs to the
// `:groupId` of the URL — never that the `:variableId`, or an `_id` in the body,
// belongs to that same company. So the scoping has to hold in the service, and
// these tests are written against it directly.
//
// The model mock below honours the `_group` filter the way MongoDB would, so a
// query that forgets it visibly reaches another company's document instead of
// silently passing.

jest.mock('../../../packages/server/common/models.common', () => ({
  PersonalizedVariables: {
    deleteOne: jest.fn(),
    findOneAndReplace: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  },
}));
jest.mock('../../../packages/server/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');
const personalizedVariableService = require('../../../packages/server/personalized-variables/personalized-variable.service');
const ERROR_CODES = require('../../../packages/server/constant/error-codes');
const {
  PersonalizedVariables,
} = require('../../../packages/server/common/models.common');

const TENANT_A = '507f1f77bcf86cd799439001';
const TENANT_B = '507f1f77bcf86cd799439002';
const TENANT_WITHOUT_VARIABLES = '507f1f77bcf86cd799439003';

const VARIABLE_A = '507f1f77bcf86cd7994390a1';
const VARIABLE_B = '507f1f77bcf86cd7994390b1'; // belongs to TENANT_B
const UNKNOWN_VARIABLE = '507f1f77bcf86cd7994390ff';
const CREATED_VARIABLE = '507f1f77bcf86cd7994390c1'; // id the create mock hands out

// --- in-memory store behaving like the collection ---------------------------

let store;

const asString = (value) =>
  value && value.toString ? value.toString() : String(value);

/** Mimics MongoDB: every key of the filter must match, compared as strings. */
const matches = (doc, filter = {}) =>
  Object.keys(filter).every((key) => {
    const expected = filter[key];
    if (expected && Array.isArray(expected.$in)) {
      return expected.$in.some((id) => asString(id) === asString(doc[key]));
    }
    return asString(doc[key]) === asString(expected);
  });

beforeEach(() => {
  jest.clearAllMocks();

  store = [
    {
      _id: VARIABLE_A,
      label: 'First name',
      variable: 'firstname',
      _group: TENANT_A,
    },
    {
      _id: VARIABLE_B,
      label: 'Last name',
      variable: 'lastname',
      _group: TENANT_B,
    },
  ];

  PersonalizedVariables.deleteOne.mockImplementation(async (filter) => {
    const index = store.findIndex((doc) => matches(doc, filter));
    if (index === -1) return { deletedCount: 0 };
    store.splice(index, 1);
    return { deletedCount: 1 };
  });

  PersonalizedVariables.findOneAndReplace.mockImplementation(
    async (filter, replacement, options = {}) => {
      const index = store.findIndex((doc) => matches(doc, filter));
      if (index === -1) {
        if (options.upsert) {
          const created = { _id: filter._id, ...replacement };
          store.push(created);
          return created;
        }
        return null;
      }
      const replaced = { _id: store[index]._id, ...replacement };
      store[index] = replaced;
      return replaced;
    }
  );

  PersonalizedVariables.create.mockImplementation(async (doc) => {
    const created = { _id: CREATED_VARIABLE, ...doc };
    store.push(created);
    return created;
  });

  PersonalizedVariables.find.mockImplementation(async (filter) =>
    store.filter((doc) => matches(doc, filter))
  );
});

const findById = (id) => store.find((doc) => asString(doc._id) === id);

// --- scoping ---------------------------------------------------------------

describe('deletePersonalizedVariable', () => {
  it('refuses to delete a variable of another company', async () => {
    await expect(
      personalizedVariableService.deletePersonalizedVariable(
        VARIABLE_B,
        TENANT_A
      )
    ).rejects.toThrow(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);

    // The victim document is still there, untouched.
    expect(findById(VARIABLE_B)).toMatchObject({ _group: TENANT_B });
    expect(store).toHaveLength(2);

    // The company reached the query, it was not just passed to the log.
    const [filter] = PersonalizedVariables.deleteOne.mock.calls[0];
    expect(asString(filter._group)).toBe(TENANT_A);
  });

  it('deletes a variable of its own company', async () => {
    await personalizedVariableService.deletePersonalizedVariable(
      VARIABLE_A,
      TENANT_A
    );

    expect(findById(VARIABLE_A)).toBeUndefined();
    expect(store).toHaveLength(1);
  });

  it('reports an unknown variable as not found', async () => {
    await expect(
      personalizedVariableService.deletePersonalizedVariable(
        UNKNOWN_VARIABLE,
        TENANT_A
      )
    ).rejects.toThrow(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);
  });
});

describe('createOrUpdatePersonalizedVariables — updating', () => {
  it('refuses to replace a variable of another company', async () => {
    await expect(
      personalizedVariableService.createOrUpdatePersonalizedVariables(
        [{ _id: VARIABLE_B, label: 'Hijacked', variable: 'hijacked' }],
        TENANT_A
      )
    ).rejects.toThrow(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);

    // Neither the content nor the company of the victim document moved.
    expect(findById(VARIABLE_B)).toMatchObject({
      label: 'Last name',
      variable: 'lastname',
      _group: TENANT_B,
    });
    expect(PersonalizedVariables.findOneAndReplace).not.toHaveBeenCalled();
  });

  it('updates a variable of its own company, scoped and without upsert', async () => {
    await personalizedVariableService.createOrUpdatePersonalizedVariables(
      [{ _id: VARIABLE_A, label: 'First name updated', variable: 'firstname' }],
      TENANT_A
    );

    expect(findById(VARIABLE_A)).toMatchObject({ label: 'First name updated' });
    expect(asString(findById(VARIABLE_A)._group)).toBe(TENANT_A);
    expect(store).toHaveLength(2);

    const [
      filter,
      ,
      options,
    ] = PersonalizedVariables.findOneAndReplace.mock.calls[0];
    expect(asString(filter._group)).toBe(TENANT_A);
    // Without upsert, an id that matches nothing can no longer create a
    // document — which is how a caller-supplied id used to enter the
    // collection.
    expect(options).toMatchObject({ upsert: false });
  });

  it('creates nothing when the id is unknown', async () => {
    await expect(
      personalizedVariableService.createOrUpdatePersonalizedVariables(
        [{ _id: UNKNOWN_VARIABLE, label: 'Ghost', variable: 'ghost' }],
        TENANT_A
      )
    ).rejects.toThrow(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);

    expect(store).toHaveLength(2);
    expect(findById(UNKNOWN_VARIABLE)).toBeUndefined();
    expect(PersonalizedVariables.findOneAndReplace).not.toHaveBeenCalled();
    expect(PersonalizedVariables.create).not.toHaveBeenCalled();
  });
});

describe('createOrUpdatePersonalizedVariables — creating', () => {
  // The UI sends no `_id` for a new variable (`_id: status === 'modified' ? _id
  // : undefined`), and the key disappears in JSON.
  it('creates a variable when no id is provided', async () => {
    await personalizedVariableService.createOrUpdatePersonalizedVariables(
      [{ label: 'City', variable: 'city' }],
      TENANT_A
    );

    expect(PersonalizedVariables.create).toHaveBeenCalledTimes(1);
    expect(PersonalizedVariables.findOneAndReplace).not.toHaveBeenCalled();
    expect(store).toHaveLength(3);
  });

  it('writes _group as an ObjectId, matching the schema and the read', async () => {
    await personalizedVariableService.createOrUpdatePersonalizedVariables(
      [{ label: 'City', variable: 'city' }],
      TENANT_A
    );

    const [doc] = PersonalizedVariables.create.mock.calls[0];
    // An ObjectId, not the nested `{ _id: groupId }` plain object the service
    // used to build. (Note: a Mongoose ObjectId does expose an `_id` getter
    // returning itself, so its absence is not what distinguishes the two.)
    expect(doc._group).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(Object.getPrototypeOf(doc._group)).not.toBe(Object.prototype);
    expect(asString(doc._group)).toBe(TENANT_A);
  });

  it('always attaches the caller company, whatever the payload claims', async () => {
    await personalizedVariableService.createOrUpdatePersonalizedVariables(
      [{ label: 'City', variable: 'city', _group: TENANT_B }],
      TENANT_A
    );

    const [doc] = PersonalizedVariables.create.mock.calls[0];
    expect(asString(doc._group)).toBe(TENANT_A);
  });

  it('handles a mixed batch of one creation and one update', async () => {
    await personalizedVariableService.createOrUpdatePersonalizedVariables(
      [
        { label: 'City', variable: 'city' },
        {
          _id: VARIABLE_A,
          label: 'First name updated',
          variable: 'firstname',
        },
      ],
      TENANT_A
    );

    expect(store).toHaveLength(3);
    expect(findById(VARIABLE_A)).toMatchObject({ label: 'First name updated' });
  });
});

// The payload is a batch and the writes are concurrent, so a rejected item must
// stop the whole thing before anything is written: the UI keeps its local rows
// on error, and a partial write would be duplicated by the next save.
describe('createOrUpdatePersonalizedVariables — batch integrity', () => {
  it('writes nothing when one item of the batch belongs to another company', async () => {
    await expect(
      personalizedVariableService.createOrUpdatePersonalizedVariables(
        [
          { label: 'City', variable: 'city' },
          { _id: VARIABLE_B, label: 'Hijacked', variable: 'hijacked' },
        ],
        TENANT_A
      )
    ).rejects.toThrow(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);

    expect(PersonalizedVariables.create).not.toHaveBeenCalled();
    expect(PersonalizedVariables.findOneAndReplace).not.toHaveBeenCalled();
    expect(store).toHaveLength(2);
  });

  it('writes nothing when one item of the batch has an unknown id', async () => {
    await expect(
      personalizedVariableService.createOrUpdatePersonalizedVariables(
        [
          { label: 'City', variable: 'city' },
          { _id: UNKNOWN_VARIABLE, label: 'Ghost', variable: 'ghost' },
        ],
        TENANT_A
      )
    ).rejects.toThrow(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);

    expect(PersonalizedVariables.create).not.toHaveBeenCalled();
    expect(store).toHaveLength(2);
  });

  // The ownership check and the write are two round trips; the guard inside the
  // update path is what covers the gap between them.
  it('reports not found when the variable disappears between check and write', async () => {
    PersonalizedVariables.findOneAndReplace.mockResolvedValue(null);

    await expect(
      personalizedVariableService.createOrUpdatePersonalizedVariables(
        [
          {
            _id: VARIABLE_A,
            label: 'First name updated',
            variable: 'firstname',
          },
        ],
        TENANT_A
      )
    ).rejects.toThrow(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);
  });

  it('accepts a batch repeating the same owned id', async () => {
    await personalizedVariableService.createOrUpdatePersonalizedVariables(
      [
        { _id: VARIABLE_A, label: 'First', variable: 'firstname' },
        { _id: VARIABLE_A, label: 'Second', variable: 'firstname' },
      ],
      TENANT_A
    );

    expect(store).toHaveLength(2);
  });
});

describe('getGroupPersonalizedVariables', () => {
  it('returns only the variables of the company', async () => {
    const result = await personalizedVariableService.getGroupPersonalizedVariables(
      TENANT_A
    );

    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe(VARIABLE_A);
  });

  it('returns nothing for a company without variables', async () => {
    const result = await personalizedVariableService.getGroupPersonalizedVariables(
      TENANT_WITHOUT_VARIABLES
    );

    expect(result).toHaveLength(0);
  });
});

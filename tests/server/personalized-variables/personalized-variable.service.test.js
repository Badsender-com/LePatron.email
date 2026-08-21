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

const VARIABLE_A = '507f1f77bcf86cd7994390a1';
const VARIABLE_B = '507f1f77bcf86cd7994390b1'; // belongs to TENANT_B
const UNKNOWN_VARIABLE = '507f1f77bcf86cd7994390ff';

// --- in-memory store behaving like the collection ---------------------------

let store;

const asString = (value) =>
  value && value.toString ? value.toString() : String(value);

/** Mimics MongoDB: every key of the filter must match, compared as strings. */
const matches = (doc, filter = {}) =>
  Object.keys(filter).every(
    (key) => asString(doc[key]) === asString(filter[key])
  );

beforeEach(() => {
  jest.clearAllMocks();

  store = [
    {
      _id: VARIABLE_A,
      label: 'Prénom',
      variable: 'firstname',
      _group: TENANT_A,
    },
    { _id: VARIABLE_B, label: 'Nom', variable: 'lastname', _group: TENANT_B },
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
    const created = { _id: UNKNOWN_VARIABLE, ...doc };
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
  });

  it('passes the company as a query filter, not just to the log', async () => {
    await personalizedVariableService
      .deletePersonalizedVariable(VARIABLE_B, TENANT_A)
      .catch(() => {});

    const [filter] = PersonalizedVariables.deleteOne.mock.calls[0];
    expect(filter).toHaveProperty('_group');
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
      label: 'Nom',
      variable: 'lastname',
      _group: TENANT_B,
    });
  });

  it('passes the company as a query filter', async () => {
    await personalizedVariableService
      .createOrUpdatePersonalizedVariables(
        [{ _id: VARIABLE_B, label: 'x', variable: 'x' }],
        TENANT_A
      )
      .catch(() => {});

    const [filter] = PersonalizedVariables.findOneAndReplace.mock.calls[0];
    expect(filter).toHaveProperty('_group');
    expect(asString(filter._group)).toBe(TENANT_A);
  });

  // Without upsert, an unknown id can no longer create a document — which is how
  // a caller-supplied id used to end up in the collection.
  it('creates nothing when the id is unknown', async () => {
    await expect(
      personalizedVariableService.createOrUpdatePersonalizedVariables(
        [{ _id: UNKNOWN_VARIABLE, label: 'Ghost', variable: 'ghost' }],
        TENANT_A
      )
    ).rejects.toThrow(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);

    expect(store).toHaveLength(2);
    expect(findById(UNKNOWN_VARIABLE)).toBeUndefined();

    const [, , options] = PersonalizedVariables.findOneAndReplace.mock.calls[0];
    expect(options.upsert).toBe(false);
  });

  it('updates a variable of its own company', async () => {
    await personalizedVariableService.createOrUpdatePersonalizedVariables(
      [{ _id: VARIABLE_A, label: 'Prénom modifié', variable: 'firstname' }],
      TENANT_A
    );

    expect(findById(VARIABLE_A)).toMatchObject({ label: 'Prénom modifié' });
    expect(asString(findById(VARIABLE_A)._group)).toBe(TENANT_A);
    expect(store).toHaveLength(2);
  });
});

describe('createOrUpdatePersonalizedVariables — creating', () => {
  // The UI sends no `_id` for a new variable (`_id: status === 'modified' ? _id
  // : undefined`), and the key disappears in JSON.
  it('creates a variable when no id is provided', async () => {
    await personalizedVariableService.createOrUpdatePersonalizedVariables(
      [{ label: 'Ville', variable: 'city' }],
      TENANT_A
    );

    expect(PersonalizedVariables.create).toHaveBeenCalledTimes(1);
    expect(PersonalizedVariables.findOneAndReplace).not.toHaveBeenCalled();
    expect(store).toHaveLength(3);
  });

  it('writes _group as an ObjectId, matching the schema and the read', async () => {
    await personalizedVariableService.createOrUpdatePersonalizedVariables(
      [{ label: 'Ville', variable: 'city' }],
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
      [{ label: 'Ville', variable: 'city', _group: TENANT_B }],
      TENANT_A
    );

    const [doc] = PersonalizedVariables.create.mock.calls[0];
    expect(asString(doc._group)).toBe(TENANT_A);
  });

  it('handles a mixed batch of one creation and one update', async () => {
    await personalizedVariableService.createOrUpdatePersonalizedVariables(
      [
        { label: 'Ville', variable: 'city' },
        { _id: VARIABLE_A, label: 'Prénom modifié', variable: 'firstname' },
      ],
      TENANT_A
    );

    expect(store).toHaveLength(3);
    expect(findById(VARIABLE_A)).toMatchObject({ label: 'Prénom modifié' });
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
      '507f1f77bcf86cd799439003'
    );

    expect(result).toHaveLength(0);
  });
});

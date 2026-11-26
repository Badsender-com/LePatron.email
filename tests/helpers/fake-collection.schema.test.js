'use strict';

// The in-memory collection with a real Mongoose schema plugged: casts, setters,
// defaults, validators, aliases and timestamps are the schema's own.

const { Types } = require('mongoose');
const { fakeCollection } = require('./fake-collection.js');

const A = '507f1f77bcf86cd799439a01';

describe('fakeCollection — with a schema', () => {
  const { Schema } = require('mongoose');
  const trim = (value) => (typeof value === 'string' ? value.trim() : value);

  let values;

  beforeEach(() => {
    values = fakeCollection({
      schema: new Schema(
        {
          _company: {
            type: Schema.Types.ObjectId,
            required: true,
            alias: 'group',
          },
          kind: { type: String, enum: ['market', 'brand'], required: true },
          label: { type: String, set: trim, maxlength: 10 },
          isActive: { type: Boolean, default: true },
        },
        { timestamps: true, toJSON: { virtuals: true } }
      ),
    });
  });

  it('casts, trims and fills the defaults on insert', async () => {
    const created = await values.create({
      _company: A,
      kind: 'market',
      label: '  Canada  ',
    });

    const [stored] = values.all();
    expect(stored._company).toBeInstanceOf(Types.ObjectId);
    expect(stored).toMatchObject({ label: 'Canada', isActive: true });
    expect(stored.createdAt).toBeInstanceOf(Date);
    expect(created.group).toEqual(stored._company);
    expect(created.toJSON()).toMatchObject({ group: stored._company });
  });

  it('refuses what the schema refuses, with its ValidationError', async () => {
    await expect(
      values.create({ _company: A, kind: 'audience', label: 'VIP' })
    ).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(
      values.create({ _company: 'not-an-id', kind: 'brand' })
    ).rejects.toMatchObject({ name: 'ValidationError' });
    expect(values.all()).toEqual([]);
  });

  it('validates a document on save', async () => {
    const doc = await values.create({ _company: A, kind: 'brand' });
    doc.label = 'Much too long a label';

    await expect(doc.save()).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('casts an update, and validates it only with runValidators', async () => {
    const doc = await values.create({ _company: A, kind: 'brand' });

    await values.updateOne({ _id: doc._id }, { label: '  Marque  ' });
    expect(values.all()[0].label).toBe('Marque');

    await values.updateOne({ _id: doc._id }, { kind: 'audience' });
    expect(values.all()[0].kind).toBe('audience');

    await expect(
      values.updateOne(
        { _id: doc._id },
        { kind: 'other' },
        { runValidators: true }
      )
    ).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(
      values.updateOne({ _id: doc._id }, { _company: 'not-an-id' })
    ).rejects.toMatchObject({ name: 'CastError' });
  });

  it('seeds fixtures as they are, like a direct insert in MongoDB', () => {
    values.seed([{ _id: 'v1', kind: 'audience' }]);

    expect(values.all()).toEqual([
      { _id: 'v1', kind: 'audience', isActive: true },
    ]);
  });
});

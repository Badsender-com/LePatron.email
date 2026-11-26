'use strict';

// The in-memory collection the taxonomy acceptance tests run on. If it matched
// too much, those tests would pass on code that forgot a filter; these pin the
// MongoDB semantics they rely on.

const { Types } = require('mongoose');
const { fakeCollection } = require('./fake-collection.js');

const A = '507f1f77bcf86cd799439a01';
const B = '507f1f77bcf86cd799439b01';

let items;

beforeEach(() => {
  items = fakeCollection({
    defaults: { isActive: true },
    unique: [['_company', 'label']],
  });
  items.seed([
    { _id: 'i1', _company: A, label: 'Canada', order: 2, tags: ['x', 'y'] },
    { _id: 'i2', _company: A, label: 'Belgique', order: 1, isActive: false },
    { _id: 'i3', _company: B, label: 'Canada', order: 3, tags: ['y'] },
  ]);
});

const labels = (docs) => docs.map((doc) => `${doc.label}@${doc._company}`);

describe('fakeCollection — queries', () => {
  it('compares an ObjectId with a string id', async () => {
    const found = await items.find({ _company: Types.ObjectId(A) });

    expect(labels(found)).toEqual([`Canada@${A}`, `Belgique@${A}`]);
  });

  it('applies the schema defaults on insert', async () => {
    expect((await items.findById('i1')).isActive).toBe(true);
  });

  it('matches an array field when one of its elements matches', async () => {
    expect(labels(await items.find({ tags: 'x' }))).toEqual([`Canada@${A}`]);
  });

  it('understands $in, $ne, $exists and $or', async () => {
    expect(await items.countDocuments({ _id: { $in: ['i1', 'i3'] } })).toBe(2);
    expect(await items.countDocuments({ _company: { $ne: A } })).toBe(1);
    expect(await items.countDocuments({ tags: { $exists: false } })).toBe(1);
    expect(
      await items.countDocuments({ $or: [{ order: 1 }, { order: 3 }] })
    ).toBe(2);
  });

  it('sorts and limits like a cursor', async () => {
    const sorted = await items.find({}).sort({ order: -1 }).limit(2).lean();

    expect(sorted.map((doc) => doc._id)).toEqual(['i3', 'i1']);
  });

  it('refuses an operator it does not know, rather than ignore it', () => {
    return expect(
      items.find({ order: { $mod: [2, 0] } }).exec()
    ).rejects.toThrow('$mod is not supported');
  });
});

describe('fakeCollection — writes', () => {
  it('saves a document read from it', async () => {
    const doc = await items.findById('i1');
    doc.label = 'Québec';
    await doc.save();

    expect((await items.findById('i1')).label).toBe('Québec');
  });

  it('honours a unique index with the MongoDB error code', async () => {
    await expect(
      items.create({ _company: A, label: 'Canada' })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('updates with $set, $pull and $addToSet', async () => {
    await items.updateOne({ _id: 'i1' }, { $set: { order: 9 } });
    await items.updateOne({ _id: 'i1' }, { $pull: { tags: 'x' } });
    await items.updateOne({ _id: 'i1' }, { $addToSet: { tags: 'y' } });

    expect(await items.findById('i1')).toMatchObject({
      order: 9,
      tags: ['y'],
    });
  });

  it('deletes one document and reports it', async () => {
    expect(await items.deleteOne({ _id: 'i2' })).toEqual({
      n: 1,
      ok: 1,
      deletedCount: 1,
    });
    expect(await items.countDocuments({})).toBe(2);
  });

  it('never hands out its own storage', async () => {
    const doc = await items.findById('i1');
    doc.label = 'changed without save';

    expect((await items.findById('i1')).label).toBe('Canada');
  });
});

describe('fakeCollection — answers as Mongoose 5.13 gives them', () => {
  it('answers exists with a boolean', async () => {
    expect(await items.exists({ label: 'Canada' })).toBe(true);
    expect(await items.exists({ label: 'Suisse' })).toBe(false);
  });

  it('counts in updateOne the documents matched and actually modified', async () => {
    expect(
      await items.updateOne({ _id: 'i1' }, { $set: { order: 9 } })
    ).toEqual({ n: 1, nModified: 1, ok: 1 });
    expect(
      await items.updateOne({ _id: 'i1' }, { $set: { order: 9 } })
    ).toEqual({ n: 1, nModified: 0, ok: 1 });
    expect(
      await items.updateOne({ _id: 'none' }, { $set: { order: 9 } })
    ).toEqual({ n: 0, nModified: 0, ok: 1 });
  });

  it('counts in updateMany only the documents that changed', async () => {
    expect(
      await items.updateMany({ _company: A }, { $set: { order: 2 } })
    ).toEqual({ n: 2, nModified: 1, ok: 1 });
  });

  it('answers findOneAndUpdate with the document before the update', async () => {
    const before = await items.findOneAndUpdate(
      { _id: 'i1' },
      { $set: { order: 9 } }
    );

    expect(before.order).toBe(2);
    expect((await items.findById('i1')).order).toBe(9);
  });

  it('answers findOneAndUpdate with the updated document when asked', async () => {
    const after = await items
      .findOneAndUpdate({ _id: 'i1' }, { $set: { order: 9 } }, { new: true })
      .lean();

    expect(after).toMatchObject({ _id: 'i1', order: 9 });
  });

  it('answers null from findOneAndUpdate when nothing matches', async () => {
    expect(
      await items.findOneAndUpdate({ _id: 'none' }, { $set: { order: 9 } })
    ).toBeNull();
  });
});

describe('fakeCollection — projections', () => {
  it('projects a document read with select, not only a lean one', async () => {
    const doc = await items.findById('i1').select({ label: 1 });

    expect({ ...doc }).toEqual({ _id: 'i1', label: 'Canada' });
  });

  it('projects with the second argument of findOne and find', async () => {
    expect({ ...(await items.findOne({ _id: 'i1' }, 'label')) }).toEqual({
      _id: 'i1',
      label: 'Canada',
    });
    expect(
      (
        await items.find({ _company: B }, { tags: 0, isActive: 0 })
      ).map((doc) => ({ ...doc }))
    ).toEqual([{ _id: 'i3', _company: B, label: 'Canada', order: 3 }]);
  });

  it('keeps the fields a projected document did not load when it is saved', async () => {
    const doc = await items.findById('i1').select('order');
    doc.order = 5;
    await doc.save();

    expect(await items.findById('i1').lean()).toMatchObject({
      label: 'Canada',
      order: 5,
      tags: ['x', 'y'],
    });
  });

  it('unsets a field a document cleared before saving', async () => {
    const doc = await items.findById('i1');
    doc.tags = undefined;
    await doc.save();

    expect(await items.findById('i1').lean()).not.toHaveProperty('tags');
  });
});

describe('fakeCollection — array updates', () => {
  it('pushes each element of $each', async () => {
    await items.updateOne(
      { _id: 'i1' },
      { $push: { tags: { $each: ['z', 'x'] } } }
    );

    expect((await items.findById('i1')).tags).toEqual(['x', 'y', 'z', 'x']);
  });

  it('adds each element of $each not already in the set', async () => {
    await items.updateOne(
      { _id: 'i1' },
      { $addToSet: { tags: { $each: ['y', 'z', 'z'] } } }
    );

    expect((await items.findById('i1')).tags).toEqual(['x', 'y', 'z']);
  });

  it('pulls the embedded documents a query matches', async () => {
    await items.updateOne(
      { _id: 'i1' },
      {
        $set: {
          links: [
            { to: 'a', weight: 1 },
            { to: 'b', weight: 2 },
          ],
        },
      }
    );
    await items.updateOne({ _id: 'i1' }, { $pull: { links: { to: 'a' } } });

    expect((await items.findById('i1')).links).toEqual([
      { to: 'b', weight: 2 },
    ]);
  });

  it('pulls the values a condition matches', async () => {
    await items.updateOne({ _id: 'i1' }, { $set: { scores: [1, 5, 8] } });
    await items.updateOne({ _id: 'i1' }, { $pull: { scores: { $gte: 5 } } });

    expect((await items.findById('i1')).scores).toEqual([1]);
  });
});

describe('fakeCollection — what it does not support, it refuses', () => {
  it.each([
    [{ $rename: { label: 'name' } }, '$rename is not supported'],
    [{ $set: { 'meta.label': 'x' } }, 'update of meta.label is not supported'],
    [
      { $push: { tags: { $each: ['z'], $slice: 2 } } },
      '$slice is not supported',
    ],
  ])('refuses the update %p', async (update, message) => {
    await expect(items.updateOne({ _id: 'i1' }, update)).rejects.toThrow(
      message
    );
  });

  it('refuses an option it does not know', async () => {
    await expect(
      items.updateOne({ _id: 'i1' }, { order: 1 }, { upsert: true })
    ).rejects.toThrow('option upsert of updateOne is not supported');
    expect(() => items.find({}, null, { skip: 2 })).toThrow(
      'option skip of find is not supported'
    );
  });
});

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

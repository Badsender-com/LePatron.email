'use strict';

// The in-memory collection the taxonomy acceptance tests run on. If it matched
// too much, those tests would pass on code that forgot a filter; these pin the
// MongoDB semantics they rely on, and the answers Mongoose 5.13 gives. Its
// projections and updates are in fake-collection.updates.test.js, a plugged
// schema in fake-collection.schema.test.js.

const { Types } = require('mongoose');
const { A, seededItems } = require('./fake-collection-fixture.js');

let items;

beforeEach(() => {
  items = seededItems();
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

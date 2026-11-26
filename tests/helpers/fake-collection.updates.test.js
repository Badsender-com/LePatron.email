'use strict';

// The in-memory collection's projections and updates, as Mongoose 5.13 and
// MongoDB apply them, and its refusal of what it does not support.

const { B, seededItems } = require('./fake-collection-fixture.js');

let items;

beforeEach(() => {
  items = seededItems();
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

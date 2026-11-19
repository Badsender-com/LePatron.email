/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The MCP fakes keep an ObjectId an ObjectId, and an aggregation finds a
// reference stored as one by an ObjectId only, as MongoDB does; `paginate`
// counts as mongoose-paginate-v2 does.

const mongoose = require('mongoose');
const { createMcpStore } = require('./mcp-fake-models.js');

const MAILING = '507f1f77bcf86cd799439401';

describe('the MCP fakes', () => {
  const store = createMcpStore();
  beforeEach(() =>
    store.seed({
      comments: [
        { _id: 'c1', _mailing: mongoose.Types.ObjectId(MAILING), n: 1 },
      ],
    })
  );

  it('reads back a stored ObjectId as an ObjectId, with its hex', async () => {
    const [comment] = await store.models.Comments.find({}).lean();

    expect(comment._mailing).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(comment._mailing)).toBe(MAILING);
  });

  it('finds it in an aggregation by an ObjectId, never by its hex', async () => {
    const byHex = await store.models.Comments.aggregate([
      { $match: { _mailing: { $in: [MAILING] } } },
    ]);
    const byId = await store.models.Comments.aggregate([
      { $match: { _mailing: { $in: [mongoose.Types.ObjectId(MAILING)] } } },
      { $group: { _id: '$_mailing', count: { $sum: 1 } } },
    ]);

    expect(byHex).toEqual([]);
    expect(byId).toHaveLength(1);
    expect(byId[0]._id.toString()).toBe(MAILING);
  });

  it('answers a lean page with ObjectId ids, as Mongoose does', async () => {
    store.seed({ mailings: [{ _id: MAILING, name: 'A' }] });

    const { docs } = await store.models.Mailings.paginate({}, { lean: true });

    expect(docs[0]._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(docs[0]._id)).toBe(MAILING);
  });

  it('groups an aggregation by an embedded field', async () => {
    store.seed({
      retex: [
        { _id: 'r1', about: { id: 'a' } },
        { _id: 'r2', about: { id: 'a' } },
        { _id: 'r3', about: { id: 'b' } },
      ],
    });

    const counts = await store.models.McpRetexes.aggregate([
      { $group: { _id: '$about.id', open: { $sum: 1 } } },
    ]);

    expect(counts).toEqual([
      { _id: 'a', open: 2 },
      { _id: 'b', open: 1 },
    ]);
  });

  it('reads $expr as MongoDB does: $indexOfCP in code points, a $literal never a path', async () => {
    store.seed({
      retex: [
        { _id: 'r1', flatQuote: '😀 under 50' },
        { _id: 'r2', flatQuote: null },
        { _id: 'r3', flatQuote: '$flatQuote' },
      ],
    });
    const found = async (expression) =>
      (await store.models.McpRetexes.find({ $expr: expression }).lean()).map(
        (r) => r._id
      );

    expect(
      await found({
        $gte: [{ $indexOfCP: ['$flatQuote', { $literal: 'under' }] }, 2],
      })
    ).toEqual(['r1']);
    expect(
      await found({
        $gte: [
          {
            $indexOfCP: [
              { $ifNull: ['$flatQuote', ''] },
              { $literal: '$flatQuote' },
            ],
          },
          0,
        ],
      })
    ).toEqual(['r3']);
  });

  it.each([
    ['a page', {}],
    ['every document at once', { pagination: false }],
  ])('counts %s, as mongoose-paginate-v2 does', async (_, options) => {
    store.seed({ mailings: [{ _id: MAILING, name: 'A' }] });
    const counts = jest.spyOn(store.models.Mailings, 'countDocuments');

    await store.models.Mailings.paginate({}, options);

    expect(counts).toHaveBeenCalledTimes(1);
    counts.mockRestore();
  });
});

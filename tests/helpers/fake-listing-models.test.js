'use strict';

// The fake listing models stand for the database in the search tests (epic
// #1144). A fake more generous than Mongoose lets a wrong service pass: these
// pin the places where the difference would hide a bug in production.

const { createListingStore } = require('./fake-listing-models.js');
const { matches, sortedBy, projected } = require('./fake-mongo-query.js');
const { aggregated } = require('./fake-mongo-aggregate.js');

const GROUP = '507f1f77bcf86cd799439b01';
const WORKSPACE = '507f1f77bcf86cd799439d01';
const FOLDER = '507f1f77bcf86cd799439e01';
const SUBFOLDER = '507f1f77bcf86cd799439e02';

function store() {
  const fake = createListingStore();
  fake.seed({
    workspaces: [{ _id: WORKSPACE, name: 'Newsletters', _company: GROUP }],
    folders: [
      { _id: FOLDER, name: '2026', _workspace: WORKSPACE },
      { _id: SUBFOLDER, name: 'Spring', _parentFolder: FOLDER },
    ],
  });
  return fake;
}

describe('fake listing models, documents', () => {
  it('answers a lean query with the stored fields only: no id, alias or virtual', async () => {
    const [workspace] = await store().Workspaces.find({}).lean();

    expect(workspace).toEqual({
      _id: WORKSPACE,
      name: 'Newsletters',
      _company: GROUP,
      _users: [],
    });
  });

  it('gives a document its id and the group alias of a workspace', async () => {
    const workspace = await store().Workspaces.findById(WORKSPACE);

    expect(workspace.id).toBe(WORKSPACE);
    expect(workspace.group).toBe(GROUP);
  });

  it('leaves the virtual populates empty unless the query populates them', async () => {
    const fake = store();
    const [plain] = await fake.Workspaces.find({});
    const [populated] = await fake.Workspaces.find({})
      .populate({ path: 'folders', populate: 'childFolders' })
      .lean();

    expect(plain.folders).toBeUndefined();
    expect(populated.folders.map((f) => f.name)).toEqual(['2026']);
    expect(populated.folders[0].childFolders.map((f) => f.name)).toEqual([
      'Spring',
    ]);
  });

  it('refuses to populate a path it holds nothing for', async () => {
    await expect(
      store().Folders.find({}).populate('_workspace')
    ).rejects.toThrow('populating folder._workspace');
  });
});

describe('fake listing models, filters as MongoDB reads them', () => {
  it('counts a stored null as existing, a missing field as not', () => {
    expect(
      matches({ _workspace: null }, { _workspace: { $exists: true } })
    ).toBe(true);
    expect(matches({}, { _workspace: { $exists: true } })).toBe(false);
    expect(matches({ _workspace: null }, { _workspace: null })).toBe(true);
    expect(matches({}, { _workspace: null })).toBe(true);
  });

  it('keeps the flags of a RegExp given to $regex', () => {
    expect(matches({ name: 'Spring' }, { name: { $regex: /spring/i } })).toBe(
      true
    );
  });

  it('matches an array field by one of its elements, or by the same array', () => {
    expect(matches({ tags: ['a', 'b'] }, { tags: 'a' })).toBe(true);
    expect(matches({ tags: ['a', 'b'] }, { tags: ['a', 'b'] })).toBe(true);
    expect(matches({ tags: ['a', 'b'] }, { tags: ['b', 'a'] })).toBe(false);
  });

  it('matches $size on the length of an array, and never on a missing field', () => {
    expect(matches({ tags: [] }, { tags: { $size: 0 } })).toBe(true);
    expect(matches({ tags: ['a'] }, { tags: { $size: 0 } })).toBe(false);
    expect(matches({}, { tags: { $size: 0 } })).toBe(false);
  });

  it('reads a dotted path into an embedded document, and through an array', () => {
    const skill = {
      activeVersion: { major: 2 },
      versions: [{ status: 'ARCHIVED' }, { status: 'ACTIVE' }],
    };

    expect(matches(skill, { 'activeVersion.major': 2 })).toBe(true);
    expect(matches(skill, { 'versions.status': 'ACTIVE' })).toBe(true);
    expect(matches(skill, { 'versions.status': 'DRAFT' })).toBe(false);
    expect(matches(skill, { 'owner.name': { $exists: false } })).toBe(true);
  });

  it.each([
    ['an unknown operator', { $text: { $search: 'spring' } }],
    ['an unknown field operator', { name: { $all: ['Spring'] } }],
    ['a positional path', { 'versions.0.status': 'ACTIVE' }],
    ['an embedded document', { location: { workspace: WORKSPACE } }],
  ])('throws on %s rather than match nothing', (_, filter) => {
    expect(() => matches({ name: 'Spring' }, filter)).toThrow(
      'is not supported'
    );
  });
});

describe('fake listing models, sort and projection', () => {
  const list = [{ n: 1 }, { n: 3 }, { n: 2 }];

  it.each([-1, 'desc', 'descending', '-n'])(
    'sorts descending with %p',
    (dir) => {
      const spec = dir === '-n' ? '-n' : { n: dir };
      expect(sortedBy(spec, list).map((r) => r.n)).toEqual([3, 2, 1]);
    }
  );

  it('reads a string projection', () => {
    expect(projected({ _id: 'x', name: 'A', data: 'B' }, 'name')).toEqual({
      _id: 'x',
      name: 'A',
    });
    expect(projected({ _id: 'x', name: 'A', data: 'B' }, '-data')).toEqual({
      _id: 'x',
      name: 'A',
    });
  });
});

describe('fake listing models, dotted projections and aggregations', () => {
  const skill = {
    _id: 'x',
    title: 'A',
    activeVersion: { major: 2, minor: 0 },
    versions: [
      { versionMajor: 1, status: 'ARCHIVED', body: 'old', testCases: [1] },
      { versionMajor: 2, status: 'ACTIVE', body: 'new', testCases: [2] },
    ],
  };

  it('keeps or drops a dotted path, in every element of an array', () => {
    expect(projected(skill, { 'versions.status': 1 })).toEqual({
      _id: 'x',
      versions: [{ status: 'ARCHIVED' }, { status: 'ACTIVE' }],
    });
    expect(
      projected(skill, { 'versions.testCases': 0 }).versions.map(Object.keys)
    ).toEqual([
      ['versionMajor', 'status', 'body'],
      ['versionMajor', 'status', 'body'],
    ]);
    expect(skill.versions[0].testCases).toEqual([1]);
  });

  it('keeps the first element that matches an $elemMatch, or no field', () => {
    expect(
      projected(skill, {
        title: 1,
        versions: { $elemMatch: { status: 'ACTIVE' } },
      })
    ).toEqual({ _id: 'x', title: 'A', versions: [skill.versions[1]] });
    expect(
      projected(skill, { versions: { $elemMatch: { status: 'DRAFT' } } })
    ).toEqual({ _id: 'x' });
  });

  it('unwinds an array, then matches and projects each element', () => {
    const answer = aggregated(
      [skill, { _id: 'y', versions: [] }],
      [
        { $match: { title: 'A' } },
        { $unwind: '$versions' },
        { $match: { 'versions.status': 'ACTIVE' } },
        { $project: { title: 1, 'versions.body': 1 } },
      ]
    );

    expect(answer).toEqual([
      { _id: 'x', title: 'A', versions: { body: 'new' } },
    ]);
  });

  // Mongoose casts a find's filter, never an aggregation's: MongoDB compares
  // the string with the ObjectId stored, and finds nothing.
  it('finds no id by a string in an aggregation, as a find does', () => {
    const id = { _bsontype: 'ObjectID', toString: () => 'abc' };
    const stored = [{ ...skill, _id: id, _company: id }];

    expect(aggregated([skill], [{ $match: { _id: 'x' } }])).toEqual([]);
    expect(aggregated([skill], [{ $match: { _id: { $in: ['x'] } } }])).toEqual(
      []
    );
    expect(aggregated(stored, [{ $match: { _company: 'abc' } }])).toEqual([]);
    expect(matches(skill, { _id: 'x' })).toBe(true);
    expect(matches(stored[0], { _company: 'abc' })).toBe(true);
  });

  it('groups by a field, with the first of each group and a sum', () => {
    const comments = [
      { _mailing: 'm1', decision: 'approved', score: 2 },
      { _mailing: 'm2', decision: null, score: 'n/a' },
      { _mailing: 'm1', decision: null, score: 3 },
      { decision: 'approved' },
    ];

    expect(
      aggregated(comments, [
        {
          $group: {
            _id: '$_mailing',
            decision: { $first: '$decision' },
            count: { $sum: 1 },
            score: { $sum: '$score' },
          },
        },
      ])
    ).toEqual([
      { _id: 'm1', decision: 'approved', count: 2, score: 5 },
      { _id: 'm2', decision: null, count: 1, score: 0 },
      { _id: null, decision: 'approved', count: 1, score: 0 },
    ]);
  });

  it.each([
    ['an unknown stage', [{ $lookup: {} }]],
    ['the unwind of a dotted path', [{ $unwind: '$a.b' }]],
    ['a group by an expression', [{ $group: { _id: { a: '$a' } } }]],
    [
      'an unknown accumulator',
      [{ $group: { _id: '$a', all: { $push: '$b' } } }],
    ],
    [
      'an $elemMatch in a $project',
      [{ $project: { versions: { $elemMatch: { status: 'ACTIVE' } } } }],
    ],
  ])('throws on %s', (_, pipeline) => {
    expect(() => aggregated([skill], pipeline)).toThrow('is not supported');
  });
});

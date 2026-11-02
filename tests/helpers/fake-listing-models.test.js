'use strict';

// The fake listing models stand for the database in the search tests (epic
// #1144). A fake more generous than Mongoose lets a wrong service pass: these
// pin the places where the difference would hide a bug in production.

const { createListingStore } = require('./fake-listing-models.js');
const { matches, sortedBy, projected } = require('./fake-mongo-query.js');

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

  it.each([
    ['an unknown operator', { $text: { $search: 'spring' } }],
    ['an unknown field operator', { name: { $elemMatch: {} } }],
    ['a dotted path', { 'location.workspace': WORKSPACE }],
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

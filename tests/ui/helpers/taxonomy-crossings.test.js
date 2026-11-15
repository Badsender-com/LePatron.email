'use strict';

// The crossings matrix of a child dimension (epic #1547, ADR-0026): its values
// in rows, the parent dimension's values in columns, a tick where a value is
// offered, a star where it is the default. A draft, saved at once: the helpers
// below build it, change it, count what changed and give the request.
//
// "Everywhere, future values included" is an empty availability (ADR-0032).
// Cells are keyed by parent value id; rows and columns keep the values' order.

const { VALUES } = require('./taxonomy-workspace.fixtures.js');

const MARKETS = VALUES.filter((v) => v.type === 'market');
const LANGUAGES = VALUES.filter((v) => v.type === 'language');

// Turned on by #1553 (the crossings matrix, and the defaults of a first-level dimension)
describe.skip('crossings matrix model', () => {
  let crossingsMatrix;
  let toggleOffered;
  let toggleEverywhere;
  let toggleDefault;
  let changedRows;
  let crossingsPayload;

  beforeAll(() => {
    ({
      crossingsMatrix,
      toggleOffered,
      toggleEverywhere,
      toggleDefault,
      changedRows,
      crossingsPayload,
    } = require('~/helpers/taxonomy-crossings.js'));
  });

  const initial = () =>
    crossingsMatrix({ parentValues: MARKETS, childValues: LANGUAGES });
  const row = (matrix, id) => matrix.rows.find((r) => r.id === id);
  const offeredIn = (matrix, id) =>
    Object.keys(row(matrix, id).cells).filter(
      (parentId) => row(matrix, id).cells[parentId].offered
    );
  const defaultsIn = (matrix, id) =>
    Object.keys(row(matrix, id).cells).filter(
      (parentId) => row(matrix, id).cells[parentId].isDefault
    );

  it('puts the parent values in columns and the child values in rows, in their order', () => {
    const matrix = initial();

    expect(matrix.columns.map((c) => c.label)).toEqual([
      'France',
      'Belgique',
      'Suisse',
      'Canada',
      'Allemagne',
    ]);
    expect(matrix.rows.map((r) => r.label)).toEqual([
      'Français',
      'Néerlandais',
      'Allemand',
      'Anglais',
      'Italien',
    ]);
  });

  it('ticks where a value is offered and stars where it is the default', () => {
    const matrix = initial();

    expect(offeredIn(matrix, 'lg-en')).toEqual(['mk-ca']);
    expect(defaultsIn(matrix, 'lg-en')).toEqual(['mk-ca']);
    expect(offeredIn(matrix, 'lg-fr')).toEqual(['mk-fr', 'mk-be', 'mk-ch']);
    expect(row(matrix, 'lg-fr').everywhere).toBe(false);
  });

  it('shows a value with an empty availability offered everywhere', () => {
    const matrix = crossingsMatrix({
      parentValues: MARKETS,
      childValues: [{ ...LANGUAGES[0], _parents: [], defaultUnder: [] }],
    });

    expect(row(matrix, 'lg-fr').everywhere).toBe(true);
    expect(offeredIn(matrix, 'lg-fr')).toHaveLength(5);
  });

  it('removes the star with the tick', () => {
    const matrix = toggleOffered(initial(), 'lg-en', 'mk-ca');

    expect(offeredIn(matrix, 'lg-en')).toEqual([]);
    expect(defaultsIn(matrix, 'lg-en')).toEqual([]);
  });

  it('switches everywhere on, the stars kept', () => {
    const matrix = toggleEverywhere(initial(), 'lg-fr');

    expect(row(matrix, 'lg-fr').everywhere).toBe(true);
    expect(offeredIn(matrix, 'lg-fr')).toHaveLength(5);
    expect(defaultsIn(matrix, 'lg-fr')).toEqual(['mk-fr', 'mk-be', 'mk-ch']);
  });

  it('switches everywhere off keeping every tick, now explicit', () => {
    const on = toggleEverywhere(initial(), 'lg-fr');
    const off = toggleEverywhere(on, 'lg-fr');

    expect(row(off, 'lg-fr').everywhere).toBe(false);
    expect(offeredIn(off, 'lg-fr')).toHaveLength(5);
  });

  it('untick one market of a value offered everywhere: no longer everywhere, the rest ticked', () => {
    const everywhere = toggleEverywhere(initial(), 'lg-fr');
    const matrix = toggleOffered(everywhere, 'lg-fr', 'mk-de');

    expect(row(matrix, 'lg-fr').everywhere).toBe(false);
    expect(offeredIn(matrix, 'lg-fr')).toEqual([
      'mk-fr',
      'mk-be',
      'mk-ch',
      'mk-ca',
    ]);
  });

  // An empty availability reads "everywhere": a value offered nowhere cannot be
  // said, and is deactivated instead.
  it('never unticks the last parent value a value is offered under', () => {
    const before = initial();

    expect(toggleOffered(before, 'lg-it', 'mk-ch')).toEqual(before);
  });

  it('never stars a value where it is not offered', () => {
    const before = initial();

    expect(toggleDefault(before, 'lg-nl', 'mk-ch')).toEqual(before);
  });

  it('moves the star of a column to the value just starred: one default per parent value', () => {
    const matrix = toggleDefault(initial(), 'lg-nl', 'mk-be');

    expect(defaultsIn(matrix, 'lg-nl')).toEqual(['mk-be']);
    expect(defaultsIn(matrix, 'lg-fr')).toEqual(['mk-fr', 'mk-ch']);
  });

  it('clears a star clicked again', () => {
    const matrix = toggleDefault(initial(), 'lg-en', 'mk-ca');

    expect(defaultsIn(matrix, 'lg-en')).toEqual([]);
  });

  it('never changes the matrix it was given', () => {
    const before = initial();
    toggleOffered(before, 'lg-en', 'mk-ca');

    expect(offeredIn(before, 'lg-en')).toEqual(['mk-ca']);
  });

  it('counts the rows the draft changed, and none for a change undone', () => {
    const start = initial();
    const draft = toggleDefault(
      toggleOffered(start, 'lg-de', 'mk-de'),
      'lg-nl',
      'mk-be'
    );

    expect(changedRows(start, draft).sort()).toEqual([
      'lg-de',
      'lg-fr',
      'lg-nl',
    ]);
    expect(
      changedRows(
        start,
        toggleOffered(toggleOffered(start, 'lg-it', 'mk-fr'), 'lg-it', 'mk-fr')
      )
    ).toEqual([]);
  });

  it('gives the request of every row, everywhere as an empty availability', () => {
    const draft = toggleEverywhere(
      toggleOffered(initial(), 'lg-it', 'mk-fr'),
      'lg-fr'
    );

    expect(crossingsPayload(draft)).toEqual([
      {
        itemId: 'lg-fr',
        parentIds: [],
        defaultUnder: ['mk-fr', 'mk-be', 'mk-ch'],
      },
      { itemId: 'lg-nl', parentIds: ['mk-be'], defaultUnder: [] },
      { itemId: 'lg-de', parentIds: ['mk-ch'], defaultUnder: [] },
      { itemId: 'lg-en', parentIds: ['mk-ca'], defaultUnder: ['mk-ca'] },
      { itemId: 'lg-it', parentIds: ['mk-fr', 'mk-ch'], defaultUnder: [] },
    ]);
  });
});

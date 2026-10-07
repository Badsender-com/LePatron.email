'use strict';

// Acceptance tests for the columns slice, at the second seam: reading and
// writing a composition (epic #1194).
//
// The half that matters most here is the one nobody asked for: a composition
// written before columns must reopen exactly as its author left it. The
// composed block has been in production behind a flag that no client template
// turns on, but "almost nobody has one" is not a reason to be allowed to lose
// them — and the moment the flag opens, this is the code that decides whether
// anything written in the meantime survives.

// Turned on by #1206 (a composition becomes rows of columns)
describe.skip('a composition of rows and columns', () => {
  let parseState;
  let serialiseState;
  let STATE_VERSION;

  beforeAll(() => {
    ({
      parseState,
      serialiseState,
    } = require('../../../packages/shared/block-builder/state.js'));
    ({
      STATE_VERSION,
    } = require('../../../packages/shared/block-builder/generate.js'));
  });

  const composition = (rows) => ({
    block: { backgroundColor: '#ffffff', paddingTop: 0, paddingBottom: 0 },
    rows,
  });

  const twoColumns = [
    {
      id: 'r1',
      columns: [
        {
          width: 50,
          elements: [{ id: 'e1', type: 'text', content: 'gauche' }],
        },
        {
          width: 50,
          elements: [{ id: 'e2', type: 'text', content: 'droite' }],
        },
      ],
    },
  ];

  it('is stored at version 2', () => {
    expect(STATE_VERSION).toBe(2);
    expect(JSON.parse(serialiseState(composition(twoColumns))).v).toBe(2);
  });

  it('comes back with its rows, columns and elements', () => {
    const read = parseState(serialiseState(composition(twoColumns)));

    expect(read.rows).toHaveLength(1);
    expect(read.rows[0].columns.map((column) => column.width)).toEqual([
      50,
      50,
    ]);
    expect(read.rows[0].columns[0].elements[0].content).toBe('gauche');
    expect(read.rows[0].columns[1].elements[0].content).toBe('droite');
  });

  it('gives every row an id of its own', () => {
    const read = parseState(
      serialiseState(
        composition([
          { columns: [{ width: 100, elements: [{ type: 'divider' }] }] },
          { columns: [{ width: 100, elements: [{ type: 'divider' }] }] },
        ])
      )
    );

    const ids = read.rows.map((row) => row.id);
    expect(ids.filter(Boolean)).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  // Two blocks composed in the same session, or a row duplicated, must not end
  // up sharing an id: selection and drag both address elements by id.
  it('makes ids unique across the whole composition', () => {
    const read = parseState(
      serialiseState(
        composition([
          {
            id: 'r1',
            columns: [
              {
                width: 50,
                elements: [{ id: 'same', type: 'text', content: 'a' }],
              },
              {
                width: 50,
                elements: [{ id: 'same', type: 'text', content: 'b' }],
              },
            ],
          },
        ])
      )
    );

    const [left, right] = read.rows[0].columns;
    expect(left.elements[0].id).not.toBe(right.elements[0].id);
  });

  describe('the limits', () => {
    it('refuses a fifth column', () => {
      const read = parseState(
        serialiseState(
          composition([
            {
              id: 'r1',
              columns: [20, 20, 20, 20, 20].map((width) => ({
                width,
                elements: [{ type: 'divider' }],
              })),
            },
          ])
        )
      );

      expect(read.rows[0].columns.length).toBeLessThanOrEqual(4);
    });

    it('brings a width below the floor back into range', () => {
      const read = parseState(
        serialiseState(
          composition([
            {
              id: 'r1',
              columns: [
                { width: 2, elements: [{ type: 'divider' }] },
                { width: 98, elements: [{ type: 'divider' }] },
              ],
            },
          ])
        )
      );

      read.rows[0].columns.forEach((column) => {
        expect(column.width).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe('a stored value is hostile', () => {
    test.each([
      ['rows that are not an array', { rows: 'nope' }],
      ['a row that is not an object', { rows: [null, 42] }],
      ['columns that are not an array', { rows: [{ columns: {} }] }],
      [
        'elements that are not an array',
        { rows: [{ columns: [{ elements: 1 }] }] },
      ],
      [
        'a width that is not a number',
        { rows: [{ columns: [{ width: 'wide' }] }] },
      ],
    ])('survives %s', (_label, shape) => {
      expect(() =>
        parseState(JSON.stringify({ v: 2, ...shape }))
      ).not.toThrow();
    });

    it('drops a key no element declares', () => {
      const read = parseState(
        serialiseState(
          composition([
            {
              id: 'r1',
              columns: [
                {
                  width: 100,
                  elements: [
                    {
                      id: 'e1',
                      type: 'text',
                      content: 'a',
                      smuggled: '<script>',
                    },
                  ],
                },
              ],
            },
          ])
        )
      );

      expect(read.rows[0].columns[0].elements[0].smuggled).toBeUndefined();
    });
  });
});

// Turned on by #1206 (a composition becomes rows of columns)
describe.skip('a composition written before columns', () => {
  let parseState;

  beforeAll(() => {
    ({
      parseState,
    } = require('../../../packages/shared/block-builder/state.js'));
  });

  // Exactly what is in the database today: version 1, a flat list of elements,
  // no rows anywhere.
  const storedBeforeColumns = JSON.stringify({
    v: 1,
    gen: '1.0.0',
    block: { backgroundColor: '#f6f6f6', paddingTop: 16, paddingBottom: 8 },
    elements: [
      { id: 'e1', type: 'text', content: 'Bonjour' },
      { id: 'e2', type: 'button', label: 'Cliquer', href: 'https://e.com' },
    ],
  });

  it('reads as one row of one full-width column', () => {
    const read = parseState(storedBeforeColumns);

    expect(read.rows).toHaveLength(1);
    expect(read.rows[0].columns).toHaveLength(1);
    expect(read.rows[0].columns[0].width).toBe(100);
  });

  it('keeps every element, in order, with its values', () => {
    const [column] = parseState(storedBeforeColumns).rows[0].columns;

    expect(column.elements.map((element) => element.type)).toEqual([
      'text',
      'button',
    ]);
    expect(column.elements[0].content).toBe('Bonjour');
    expect(column.elements[1].href).toBe('https://e.com');
  });

  it('keeps the block settings its author chose', () => {
    expect(parseState(storedBeforeColumns).block.backgroundColor).toBe(
      '#f6f6f6'
    );
    expect(parseState(storedBeforeColumns).block.paddingTop).toBe(16);
  });

  // The generator version is read as stored, never bumped on read: it is how a
  // reopened block can tell that applying it would rebuild its markup.
  it('reports the generator that wrote it', () => {
    expect(parseState(storedBeforeColumns).gen).toBe('1.0.0');
  });

  // The guard that already exists, and must keep existing: a composition from a
  // version this code does not know is refused outright, which the server turns
  // into a visible error rather than an emptied block.
  it('still refuses a composition from a later version', () => {
    expect(
      parseState(JSON.stringify({ v: 99, rows: [], elements: [] }))
    ).toBeNull();
  });
});

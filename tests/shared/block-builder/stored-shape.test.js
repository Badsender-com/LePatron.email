'use strict';

// Which shape a composition is stored in, and rendered as.
//
// In memory a composition is always rows. It is written in the oldest shape
// that holds it: a flat composition — one row of one full-width column, with
// nothing set on either — as version 1 (`elements`), anything else as version 2
// (`rows`). A block that never used columns therefore stays readable by a
// version from before them, and renders exactly as it did.

const {
  serialiseState,
  parseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  generate,
  generateElement,
  emptyState,
  GENERATOR_VERSION,
  STATE_VERSION,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  singleColumnRows,
  elementsOfState,
  isFlatComposition,
  singleColumnElements,
} = require('../../../packages/shared/block-builder/composition.js');
const {
  elementFor,
} = require('../../../packages/shared/block-builder/elements/index.js');

const text = (id, content) => ({ id, type: 'text', content });

const twoColumns = () => [
  {
    id: 'row-a-1',
    columns: [
      { width: 50, elements: [text('e1', 'gauche')] },
      { width: 50, elements: [text('e2', 'droite')] },
    ],
  },
];

const flat = (...elements) => ({
  ...emptyState(),
  rows: singleColumnRows(elements),
});

const stored = (state) => JSON.parse(serialiseState(state));

describe('emptyState', () => {
  it('is rows, with no flat view beside them', () => {
    expect(emptyState().elements).toBeUndefined();
    expect(Array.isArray(emptyState().rows)).toBe(true);
  });

  it('keeps the rows spread over it', () => {
    const written = stored({ ...emptyState(), rows: twoColumns() });

    expect(written.rows).toHaveLength(1);
    expect(written.rows[0].columns).toHaveLength(2);
    expect(written.elements).toBeUndefined();
  });

  it('is stored as an empty flat composition', () => {
    expect(stored(emptyState())).toEqual({
      v: 1,
      gen: GENERATOR_VERSION,
      block: emptyState().block,
      elements: [],
    });
  });
});

describe('the shape written', () => {
  it('writes a composition of two columns as version 2 rows', () => {
    const written = stored({ ...emptyState(), rows: twoColumns() });

    expect(written.v).toBe(STATE_VERSION);
    expect(written.v).toBe(2);
  });

  it('writes one row of one column as version 1 elements', () => {
    const written = stored(flat(text('e1', 'Bonjour')));

    expect(written.v).toBe(1);
    expect(written.rows).toBeUndefined();
    expect(written.elements.map((element) => element.content)).toEqual([
      'Bonjour',
    ]);
  });

  it('writes two rows as version 2, even of one column each', () => {
    const [first] = singleColumnRows([text('e1', 'a')]);
    const [second] = singleColumnRows([text('e2', 'b')]);

    expect(stored({ ...emptyState(), rows: [first, second] }).v).toBe(2);
  });

  it('writes a single column narrower than the block as version 2', () => {
    const rows = singleColumnRows([text('e1', 'a')]);
    rows[0].columns[0].width = 50;

    expect(stored({ ...emptyState(), rows }).v).toBe(2);
  });

  // A row setting is what columns bring beyond a flat list: a composition
  // using one must not be written in a shape that has nowhere to keep it.
  it('writes a row carrying any setting as version 2', () => {
    const rows = singleColumnRows([text('e1', 'a')]);
    rows[0].valign = 'middle';

    expect(isFlatComposition({ rows })).toBe(false);
    expect(stored({ ...emptyState(), rows }).v).toBe(2);
  });

  it('writes a column carrying any setting as version 2', () => {
    const rows = singleColumnRows([text('e1', 'a')]);
    rows[0].columns[0].padding = 8;

    expect(stored({ ...emptyState(), rows }).v).toBe(2);
  });

  it('writes nothing but the version, generator, block and content', () => {
    const written = stored({ ...flat(text('e1', 'a')), smuggled: 'x' });

    expect(Object.keys(written)).toEqual(['v', 'gen', 'block', 'elements']);
  });
});

describe('a version 1 composition', () => {
  // As the editor creates an element: its template's defaults, then edited.
  const created = (id, type, values) => ({
    id,
    type,
    ...elementFor(type).defaults,
    ...values,
  });
  const v1 = serialiseState(
    flat(
      created('e1', 'text', { content: 'Bonjour' }),
      created('e2', 'button', { label: 'Cliquer', href: 'https://e.com' })
    )
  );

  it('reads as one row of one full-width column', () => {
    const read = parseState(v1);

    expect(read.elements).toBeUndefined();
    expect(read.rows).toHaveLength(1);
    expect(read.rows[0].columns).toEqual([
      { width: 600, elements: expect.any(Array) },
    ]);
    expect(isFlatComposition(read)).toBe(true);
  });

  it('is written back identical', () => {
    expect(serialiseState(parseState(v1))).toBe(v1);
  });

  it('renders as the flat list it always was', () => {
    const read = parseState(v1);
    const [first, second] = singleColumnElements(read);

    expect(generate(read)).toContain(
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
        generateElement(first) +
        generateElement(second) +
        '</table>'
    );
    expect(generate(read)).toBe(generate(flat(first, second)));
  });
});

describe('a version 2 composition', () => {
  it('comes back with its rows, and renders them', () => {
    const read = parseState(
      serialiseState({ ...emptyState(), rows: twoColumns() })
    );

    // Written in percent, read in px of the 600px block.
    expect(read.rows[0].columns.map((column) => column.width)).toEqual([
      300,
      300,
    ]);
    expect(generate(read)).toContain('width="50%"');
    expect(generate(read)).toContain('gauche');
    expect(generate(read)).toContain('droite');
  });

  // Rows win over a flat list stored beside them: the rows are what a version
  // that knows columns wrote.
  it('reads its rows, never an `elements` stored beside them', () => {
    const read = parseState(
      JSON.stringify({
        v: 2,
        rows: twoColumns(),
        elements: [text('x', 'à côté')],
      })
    );

    expect(elementsOfState(read).map((element) => element.content)).toEqual([
      'gauche',
      'droite',
    ]);
  });
});

describe('elementsOfState', () => {
  it('lists every element in document order', () => {
    const state = {
      rows: [...twoColumns(), ...singleColumnRows([text('e3', 'dessous')])],
    };

    expect(elementsOfState(state).map((element) => element.id)).toEqual([
      'e1',
      'e2',
      'e3',
    ]);
  });

  it('hands out the composition’s own elements', () => {
    const state = { rows: twoColumns() };

    elementsOfState(state)[1].content = 'changé';

    expect(state.rows[0].columns[1].elements[0].content).toBe('changé');
  });

  it('survives a state that is not a composition', () => {
    expect(elementsOfState(null)).toEqual([]);
    expect(elementsOfState({ rows: 'nope' })).toEqual([]);
    expect(elementsOfState({ rows: [null, { columns: 42 }] })).toEqual([]);
  });
});

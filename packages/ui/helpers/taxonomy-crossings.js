/**
 * The crossings matrix of a child dimension (ADR-0026): its values in rows,
 * the parent dimension's values in columns, a tick where a value is offered, a
 * star where it is the default. A draft: these helpers build it, change it
 * without touching the one given, count what changed and give the request.
 * Covered by tests/ui/helpers/taxonomy-crossings.test.js.
 *
 * "Everywhere, future values included" is an empty availability (ADR-0014):
 * a value offered nowhere cannot be said, it is deactivated instead.
 */

const ids = (list) => (list || []).map(String);

const cellsOf = (columns, parents, defaults) => {
  const everywhere = parents.length === 0;
  return Object.fromEntries(
    columns.map((column) => [
      column.id,
      {
        offered: everywhere || parents.includes(column.id),
        isDefault: defaults.includes(column.id),
      },
    ])
  );
};

/**
 * @param {Object} params
 * @param {Object[]} params.parentValues the columns, in their order
 * @param {Object[]} params.childValues the rows, with `_parents` and
 *   `defaultUnder`
 * @returns {{columns: Object[], rows: Object[]}}
 */
export function crossingsMatrix({ parentValues = [], childValues = [] }) {
  const columns = parentValues.map((value) => ({
    id: String(value.id),
    label: value.label,
  }));
  const rows = childValues.map((value) => {
    const parents = ids(value._parents);
    return {
      id: String(value.id),
      label: value.label,
      isActive: value.isActive !== false,
      everywhere: parents.length === 0,
      cells: cellsOf(columns, parents, ids(value.defaultUnder)),
    };
  });
  return { columns, rows };
}

const withRow = (matrix, rowId, change) => ({
  columns: matrix.columns,
  rows: matrix.rows.map((row) => (row.id === rowId ? change(row) : row)),
});

const withCell = (row, parentId, cell) => ({
  ...row,
  cells: { ...row.cells, [parentId]: { ...row.cells[parentId], ...cell } },
});

/** Tick or untick a cell; never the last tick of a row. */
export function toggleOffered(matrix, rowId, parentId) {
  const row = matrix.rows.find((r) => r.id === rowId);
  if (!row || !row.cells[parentId]) return matrix;
  const offered = !row.cells[parentId].offered;
  const ticked = Object.values(row.cells).filter((cell) => cell.offered);
  if (!offered && !row.everywhere && ticked.length === 1) return matrix;
  return withRow(matrix, rowId, (r) => ({
    ...withCell(
      r,
      parentId,
      offered ? { offered } : { offered, isDefault: false }
    ),
    everywhere: false,
  }));
}

/** Offer a value everywhere, or keep every tick explicit; stars kept. */
export function toggleEverywhere(matrix, rowId) {
  return withRow(matrix, rowId, (row) => {
    const cells = Object.fromEntries(
      Object.entries(row.cells).map(([id, cell]) => [
        id,
        { ...cell, offered: true },
      ])
    );
    return { ...row, cells, everywhere: !row.everywhere };
  });
}

/**
 * Star a value under a parent value, moving the star of that column; clear a
 * star clicked again. Never where the value is not offered.
 */
export function toggleDefault(matrix, rowId, parentId) {
  const row = matrix.rows.find((r) => r.id === rowId);
  const cell = row && row.cells[parentId];
  if (!cell || !cell.offered) return matrix;
  if (cell.isDefault) {
    return withRow(matrix, rowId, (r) =>
      withCell(r, parentId, { isDefault: false })
    );
  }
  return {
    columns: matrix.columns,
    rows: matrix.rows.map((r) =>
      withCell(r, parentId, { isDefault: r.id === rowId })
    ),
  };
}

const payloadOf = (matrix, row) => ({
  itemId: row.id,
  parentIds: row.everywhere
    ? []
    : matrix.columns.map((c) => c.id).filter((id) => row.cells[id].offered),
  defaultUnder: matrix.columns
    .map((c) => c.id)
    .filter((id) => row.cells[id].isDefault),
});

/** The request of every row, in the rows' order. */
export function crossingsPayload(matrix) {
  return matrix.rows.map((row) => payloadOf(matrix, row));
}

/** The ids of the rows whose request differs from the initial one. */
export function changedRows(initial, draft) {
  const before = Object.fromEntries(
    crossingsPayload(initial).map((entry) => [entry.itemId, entry])
  );
  return crossingsPayload(draft)
    .filter(
      (entry) => JSON.stringify(entry) !== JSON.stringify(before[entry.itemId])
    )
    .map((entry) => entry.itemId);
}

'use strict';

// The difference a draft makes with the active version, for the person to
// read before publishing (ADR 0014): a diff of lines, field by field and in
// order, each change between the lines around it, so that a line moved, or
// an expertise consumed in another order, shows where. Bounded, in time as in
// size: a field whose changed part differs by more than MAX_EDITS lines is
// shown as that part removed then added, and the whole diff keeps MAX_LINES
// lines, each cut at MAX_LINE_LENGTH.

const MAX_LINES = 200;
const MAX_LINE_LENGTH = 200;
const MAX_EDITS = MAX_LINES;
// The unchanged lines shown on each side of a change.
const CONTEXT = 1;

// The lines of a field: a text cut at its line breaks, a list one item a
// line; blank lines say nothing of a change.
function linesOf(value) {
  const text = Array.isArray(value) ? value.join('\n') : String(value || '');
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
}

/**
 * The shortest edit script from `a` to `b` (Myers), or null when it takes
 * more than `maxEdits` lines added or removed: the work grows with the
 * lengths times the edits, never beyond `maxEdits` of them.
 *
 * @returns {Array<[string, string]>|null} `['-', line]`, `['+', line]` and
 *   `[' ', line]`, in order
 */
function editScript(a, b, maxEdits) {
  const offset = maxEdits + 1;
  const v = new Array(2 * offset + 1).fill(0);
  const trace = [];
  for (let d = 0; d <= Math.min(maxEdits, a.length + b.length); d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      const down =
        k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]);
      let x = down ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < a.length && y < b.length && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= a.length && y >= b.length) {
        return backtrack(a, b, trace, offset);
      }
    }
  }
  return null;
}

function backtrack(a, b, trace, offset) {
  const script = [];
  let x = a.length;
  let y = b.length;
  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const v = trace[d];
    const k = x - y;
    const down = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]);
    const previousK = down ? k + 1 : k - 1;
    const previousX = d === 0 ? 0 : v[offset + previousK];
    const previousY = d === 0 ? 0 : previousX - previousK;
    while (x > previousX && y > previousY) {
      script.push([' ', a[x - 1]]);
      x -= 1;
      y -= 1;
    }
    if (d > 0) {
      if (x === previousX) script.push(['+', b[y - 1]]);
      else script.push(['-', a[x - 1]]);
      x = previousX;
      y = previousY;
    }
  }
  return script.reverse();
}

// The edit script of a field, in order. What both versions start and end
// with is set aside first, so the diff works on the changed part only.
function scriptOf(before, after) {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  ) {
    start += 1;
  }
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end += 1;
  }
  const removed = before.slice(start, before.length - end);
  const added = after.slice(start, after.length - end);
  const middle = editScript(removed, added, MAX_EDITS) || [
    ...removed.map((line) => ['-', line]),
    ...added.map((line) => ['+', line]),
  ];
  return [
    ...before.slice(0, start).map((line) => [' ', line]),
    ...middle,
    ...before.slice(before.length - end).map((line) => [' ', line]),
  ];
}

const cut = (line) =>
  line.length > MAX_LINE_LENGTH ? `${line.slice(0, MAX_LINE_LENGTH)}…` : line;

// The changes of a script, each with CONTEXT unchanged lines around it, and
// `…` where unchanged lines are left out.
function hunksOf(script) {
  const shown = new Array(script.length).fill(false);
  script.forEach(([sign], index) => {
    if (sign === ' ') return;
    const from = Math.max(0, index - CONTEXT);
    const to = Math.min(script.length - 1, index + CONTEXT);
    for (let i = from; i <= to; i += 1) shown[i] = true;
  });
  const lines = [];
  script.forEach(([sign, line], index) => {
    if (shown[index]) lines.push(`${sign} ${cut(line)}`);
    else if (index === 0 || shown[index - 1]) lines.push('  …');
  });
  return lines;
}

/**
 * The difference between two versions, field by field: a `@@ field` line,
 * then the lines it removes (`- `) and adds (`+ `), in order, between the
 * unchanged lines around them (`  `). Fields that do not change say nothing.
 *
 * @param {Object|null} before the active version, none when nothing is
 *   published
 * @param {Object} after the draft
 * @param {string[]} fields the fields compared, in the order shown
 * @returns {string} at most MAX_LINES lines, then how many more there are
 */
function draftDiff(before, after, fields) {
  const kept = [];
  let more = 0;
  fields.forEach((field) => {
    const script = scriptOf(
      linesOf(before && before[field]),
      linesOf(after[field])
    );
    if (script.every(([sign]) => sign === ' ')) return;
    const lines = [`@@ ${field}`, ...hunksOf(script)];
    const room = Math.max(0, MAX_LINES - kept.length);
    kept.push(...lines.slice(0, room));
    more += Math.max(0, lines.length - room);
  });
  return more ? [...kept, `… ${more} more lines`].join('\n') : kept.join('\n');
}

// A field as stored, for telling a change the diff does not show (spaces,
// blank lines) from none.
const rawOf = (value) =>
  Array.isArray(value) ? value.join('\n') : String(value || '');

/**
 * Whether two versions differ at all in the fields, spaces and blank lines
 * included, which the diff leaves out.
 *
 * @param {Object|null} before
 * @param {Object} after
 * @param {string[]} fields
 * @returns {boolean}
 */
function differs(before, after, fields) {
  return fields.some(
    (field) => rawOf(before && before[field]) !== rawOf(after[field])
  );
}

module.exports = { draftDiff, differs, MAX_LINES };

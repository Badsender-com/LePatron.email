'use strict';

// The modules of the skills and expertises require one another without a
// cycle, a require written inside a function included: such a require only
// hides the cycle, and the module it reads may be half loaded.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../../packages/server/ai-skill');
const RELATIVE_REQUIRE = /require\('(\.{1,2}\/[^']+)'\)/g;

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

function resolved(from, request) {
  const target = path.join(path.dirname(from), request);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  if (fs.existsSync(`${target}.js`)) return `${target}.js`;
  return path.join(target, 'index.js');
}

function requireGraph() {
  const files = filesUnder(ROOT);
  const known = new Set(files);
  return new Map(
    files.map((file) => [
      file,
      [...fs.readFileSync(file, 'utf8').matchAll(RELATIVE_REQUIRE)]
        .map((match) => resolved(file, match[1]))
        .filter((target) => known.has(target)),
    ])
  );
}

function cyclesOf(graph) {
  const cycles = [];
  const done = new Set();
  const visit = (file, stack) => {
    const at = stack.indexOf(file);
    if (at !== -1) {
      cycles.push(
        [...stack.slice(at), file]
          .map((f) => path.relative(ROOT, f))
          .join(' -> ')
      );
      return;
    }
    if (done.has(file)) return;
    graph.get(file).forEach((next) => visit(next, [...stack, file]));
    done.add(file);
  };
  [...graph.keys()].forEach((file) => visit(file, []));
  return cycles;
}

describe('the modules of the skills and expertises', () => {
  it('require one another without a cycle', () => {
    expect(cyclesOf(requireGraph())).toEqual([]);
  });
});

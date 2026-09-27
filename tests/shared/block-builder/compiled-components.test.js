'use strict';

// The golden test.
//
// The element templates are now compiled from Vue components, and the result is
// committed. That arrangement only holds while the committed file is provably
// the output of the committed source — otherwise a quick fix made by hand in
// the generated file survives until someone recompiles and silently loses it.
//
// So this runs the real compiler, the way a developer runs it, and fails on any
// difference. Without it, "Badsender keeps control of the generated HTML" stops
// being true at the first hand-edit.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const COMPONENTS = path.join(
  REPO,
  'packages',
  'shared',
  'block-builder',
  'components'
);

const componentNames = fs
  .readdirSync(COMPONENTS)
  .filter((file) => file.endsWith('.vue'))
  .map((file) => path.basename(file, '.vue'));

describe('the compiled components match their sources', () => {
  // Rendering Vue and running Tailwind costs a second or two, which is why this
  // is one test rather than one per component.
  it('recompiles to exactly what is committed', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          path.join('scripts', 'compile-block-builder-components.js'),
          '--check',
        ],
        { cwd: REPO, encoding: 'utf8', stdio: 'pipe' }
      )
    ).not.toThrow();
  }, 60000);
});

describe('every component ships what the generator needs', () => {
  test.each(componentNames)('%s', (name) => {
    const compiled = require(path.join(COMPONENTS, `${name}.compiled.js`));

    expect(typeof compiled).toBe('string');
    expect(compiled).not.toBe('');

    // Inlining is the whole point of the build step: a block lands in other
    // people's templates and can rely on no stylesheet but its own.
    expect(compiled).not.toMatch(/\sclass="/);

    // Vue leaves these behind when a component has several roots or a v-if it
    // could not resolve. Either would end up in a real email.
    expect(compiled).not.toContain('<!--[-->');
    expect(compiled).not.toContain('data-v-');

    // A sentinel that survived means a prop was rendered that no slot declares,
    // which would ship a placeholder string to a recipient.
    expect(compiled).not.toMatch(/LPSLOT[A-Za-z0-9]/);
  });

  // The manifest is where the escaping context lives now that the markup is
  // written in Vue. A slot missing from it has no context, and the compiler is
  // what refuses to emit — but nothing stops someone deleting the check, so the
  // outcome is pinned here too.
  test.each(componentNames)('%s declares a context for every hole', (name) => {
    const compiled = require(path.join(COMPONENTS, `${name}.compiled.js`));
    const holes = compiled.match(/\[\[[^\]]*\]\]/g) || [];

    expect(holes.length).toBeGreaterThan(0);
    holes.forEach((hole) => {
      const [, context] = hole.slice(2, -2).split('|');
      expect([
        'TEXT',
        'ATTR',
        'URL',
        'COLOR',
        'PX',
        'CSS_VALUE',
        'RICH_TEXT',
      ]).toContain(context);
    });
  });
});

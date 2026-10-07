'use strict';

// The golden test.
//
// The element templates are now compiled from Vue components, and the result is
// committed. That arrangement only holds while the committed file is provably
// the output of the committed source — otherwise a quick fix made by hand in
// the generated file survives until someone recompiles and silently loses it.
//
// So this runs the real compiler, in-process, and compares each committed file
// with what it would write — one test per component, so a failure names the
// component and shows the diff. Without it, "Badsender keeps control of the
// generated HTML" stops being true at the first hand-edit.

const fs = require('fs');
const path = require('path');
const {
  isGeneratedClass,
} = require('../../../packages/shared/block-builder/generated-classes.js');

const {
  COMPONENTS_DIR: COMPONENTS,
  compileComponent,
  listComponents,
} = require('../../../scripts/block-builder/compile-component.js');
const {
  CONTEXTS,
} = require('../../../packages/shared/block-builder/slot-contexts.js');

const componentNames = listComponents();

describe('the compiled components match their sources', () => {
  // The test name carries the fix, since it is what a failure prints first.
  test.each(componentNames)(
    '%s.compiled.js is what `yarn block-builder:compile` writes',
    async (name) => {
      const destination = path.join(COMPONENTS, `${name}.compiled.js`);
      const current = fs.existsSync(destination)
        ? fs.readFileSync(destination, 'utf8')
        : '';
      // One tag per line, so the diff points at the tag that changed rather
      // than at a single line of a thousand characters.
      const byTag = (file) => file.replace(/></g, '>\n<');
      expect(byTag(current)).toBe(byTag(await compileComponent(name)));
    },
    30000
  );

  // The editor bundle requires the compiled files directly, and nothing lints
  // them. One left behind by a renamed or deleted component would ship stale
  // markup with no source anyone can edit.
  it('has no compiled file or manifest without its component', () => {
    const orphans = fs
      .readdirSync(COMPONENTS)
      .filter((file) => /\.(compiled|slots)\.js$/.test(file))
      .filter((file) => {
        const name = file.replace(/\.(compiled|slots)\.js$/, '');
        return !componentNames.includes(name);
      });
    expect(orphans).toEqual([]);
  });
});

/**
 * The templates a component ships, keyed by variant — `default` alone when its
 * markup does not branch. Branches are resolved at build time, once per
 * variant, because the generator joins strings and never branches.
 */
function templatesOf(name) {
  return require(path.join(COMPONENTS, `${name}.compiled.js`));
}

describe('every component ships what the generator needs', () => {
  test.each(componentNames)('%s', (name) => {
    const templates = templatesOf(name);
    expect(Object.keys(templates).length).toBeGreaterThan(0);

    Object.values(templates).forEach((compiled) => {
      expect(typeof compiled).toBe('string');
      expect(compiled).not.toBe('');

      // Inlining is the whole point of the build step: a block lands in other
      // people's templates and can rely on no stylesheet but its own.
      //
      // Which is why what survives in a `class` matters more than whether one
      // is there at all. A Tailwind utility surviving means the inliner missed
      // it, and the block would depend on a stylesheet it does not control.
      // A name the generator owns is the opposite case: nothing could inline
      // it, because it only means something inside a media query, and the
      // stylesheet in the document head is about to refer to it by name. A
      // slot that lands in a class is still a sentinel at this point.
      (compiled.match(/\sclass="([^"]*)"/g) || []).forEach((attribute) => {
        attribute
          .replace(/^\sclass="|"$/g, '')
          .split(/\s+/)
          .filter(Boolean)
          .forEach((className) => {
            expect(
              isGeneratedClass(className) || className.startsWith('[[')
            ).toBe(true);
          });
      });

      // A comment in a component is a note for its next author. Only Outlook's
      // conditional comments are markup, and only they may ship.
      const outsideConditionals = compiled
        .replace(/<!--\[if [^\]]*\]>(<!-->)?/g, '')
        .replace(/(<!--)?<!\[endif\]-->/g, '');
      expect(outsideConditionals).not.toContain('<!--');

      // Vue leaves these behind when a component has several roots or a v-if it
      // could not resolve. Either would end up in a real email.
      expect(compiled).not.toContain('<!--[-->');
      expect(compiled).not.toContain('data-v-');

      // A sentinel that survived means a prop was rendered that no slot declares,
      // which would ship a placeholder string to a recipient.
      expect(compiled).not.toMatch(/LPSLOT[A-Za-z0-9]/);

      // Vue decodes `&nbsp;` into a raw U+00A0 on its way through, and the raw
      // character is not the same thing downstream — the export encodes
      // non-ASCII to numeric entities, so what a recipient receives would depend
      // on which path produced it. The spacer and the divider both rely on that
      // character keeping a cell from collapsing.
      expect(compiled).not.toMatch(/[\u0080-\uFFFF]/);
    });
  });

  // The manifest is where the escaping context lives now that the markup is
  // written in Vue. A slot missing from it has no context, and the compiler is
  // what refuses to emit — but nothing stops someone deleting the check, so the
  // outcome is pinned here too.
  test.each(componentNames)('%s declares a context for every hole', (name) => {
    const holes = Object.values(templatesOf(name)).flatMap(
      (compiled) => compiled.match(/\[\[[^\]]*\]\]/g) || []
    );

    expect(holes.length).toBeGreaterThan(0);
    holes.forEach((hole) => {
      const [, context] = hole.slice(2, -2).split('|');
      expect(CONTEXTS).toContain(context);
    });
  });
});

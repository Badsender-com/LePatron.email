'use strict';

// Two changes that only make sense together (#1204): a class the generator owns
// survives compilation, and a layout may nest markup.
//
// Both are the same shape of mistake — a rule written for the single-column
// builder that becomes wrong the moment there are columns. Stripping every
// class was right while everything could be inlined. Escaping every slot was
// right while no slot ever held markup the generator itself had produced.

const {
  escapeForContext,
  MARKUP,
  CONTEXTS,
} = require('../../../../packages/shared/block-builder/slot-contexts.js');
const {
  isGeneratedClass,
  stackClassFor,
  GENERATED_CLASSES,
} = require('../../../../packages/shared/block-builder/generated-classes.js');

const STACK_CLASS = 'lp-stack';
const {
  defineLayout,
} = require('../../../../packages/shared/block-builder/template.js');
const { compileFixture } = require('./fixture.js');

describe('a class the generator owns', () => {
  it('is one the closed list names', () => {
    expect(GENERATED_CLASSES).toEqual([
      STACK_CLASS,
      'lp-gutter',
      ...[4, 8, 12, 16, 20, 24, 28, 32, 36, 40].map(
        (spacing) => `lp-stack-spacing-${spacing}`
      ),
    ]);
    expect(isGeneratedClass(STACK_CLASS)).toBe(true);
  });

  // The prefix is shared with the editor's own markers, so it proves nothing.
  test.each([
    ['a Tailwind utility', 'text-center'],
    ['something that only contains the name', 'not-lp-stack'],
    ['a typo with the right prefix', 'lp-stak'],
    ['a class of the editor', 'lp-bb-selected'],
    ['nothing at all', ''],
    ['a non-string', null],
  ])('does not recognise %s', (_label, value) => {
    expect(isGeneratedClass(value)).toBe(false);
  });

  // The bug this whole ticket exists for: a stacking class only means something
  // inside a media query, so inlining it is impossible by definition, and
  // stripping every class is what made a responsive rule unreachable.
  it('survives compilation', async () => {
    const compiled = await compileFixture({
      template: `<table><tr><td class="${STACK_CLASS}">{{ label }}</td></tr></table>`,
      slots: { label: { context: 'TEXT' } },
    });

    expect(compiled.default).toContain(`${STACK_CLASS}`);
  });

  // The other half: a utility that was inlined has no business shipping its
  // name to every recipient.
  it('does not keep a Tailwind utility beside it', async () => {
    const compiled = await compileFixture({
      template: `<table><tr><td class="text-center ${STACK_CLASS}">{{ label }}</td></tr></table>`,
      slots: { label: { context: 'TEXT' } },
    });

    expect(compiled.default).toContain(`${STACK_CLASS}`);
    expect(compiled.default).not.toContain('text-center');
    expect(compiled.default).toMatch(/text-align:\s*center/);
  });

  it('leaves no empty class attribute behind', async () => {
    const compiled = await compileFixture({
      template:
        '<table><tr><td class="text-center">{{ label }}</td></tr></table>',
      slots: { label: { context: 'TEXT' } },
    });

    expect(compiled.default).not.toContain('class=');
  });

  // The compiler refuses a class that inlines to nothing, because that is how a
  // typo used to ship. A generated class inlines to nothing ON PURPOSE, so it
  // has to be exempt — otherwise the guard refuses exactly what it is for.
  it('is exempt from the check that a class must inline', async () => {
    await expect(
      compileFixture({
        template: `<table><tr><td class="${STACK_CLASS}">{{ label }}</td></tr></table>`,
        slots: { label: { context: 'TEXT' } },
      })
    ).resolves.toBeDefined();
  });

  // Only the listed names are: a typo with the prefix is a typo.
  it('does not exempt a name the list does not hold', async () => {
    await expect(
      compileFixture({
        template:
          '<table><tr><td class="lp-stak">{{ label }}</td></tr></table>',
        slots: { label: { context: 'TEXT' } },
      })
    ).rejects.toThrow(/"lp-stak" inlines to nothing/);
  });

  it('still refuses a utility that inlines to nothing', async () => {
    await expect(
      compileFixture({
        template:
          '<table><tr><td class="not-a-real-utility">{{ label }}</td></tr></table>',
        slots: { label: { context: 'TEXT' } },
      })
    ).rejects.toThrow(/inlines to nothing/);
  });
});

// An element's slots are filled from stored state: escaped, a value in `class`
// could still name any class the template or the head CSS defines. A layout's
// class slot is filled by the generator with a name of its own.
describe('a slot in a class attribute', () => {
  const template = '<table><tr><td :class="tone">a</td></tr></table>';
  const slots = { tone: { context: 'ATTR' } };

  it('is refused in an element, naming the slot', async () => {
    await expect(compileFixture({ template, slots })).rejects.toThrow(
      /the slot "tone" fills a class attribute, which only a layout may do/
    );
  });

  it("says to declare `kind: 'layout'` only for the generator", async () => {
    await expect(compileFixture({ template, slots })).rejects.toThrow(
      /declare `kind: 'layout'` in the manifest only if the generator/
    );
  });

  it('is refused beside a static class too', async () => {
    await expect(
      compileFixture({
        template: `<table><tr><td class="${STACK_CLASS}" :class="tone">a</td></tr></table>`,
        slots,
      })
    ).rejects.toThrow(/fills a class attribute/);
  });

  it('is kept in a layout', async () => {
    const compiled = await compileFixture({ template, slots, kind: 'layout' });

    expect(compiled.default).toContain('class="[[tone|ATTR|]]"');
  });
});

describe('the class a column stacks with', () => {
  it('is the listed class for a row of several columns', () => {
    expect(stackClassFor(2)).toBe(STACK_CLASS);
  });

  it('is nothing for a row of one column', () => {
    expect(stackClassFor(1)).toBe('');
  });

  // Whatever the column count, so a typo cannot hide behind a single column.
  test.each([1, 2])('refuses a behaviour the list does not name (%i)', (n) => {
    expect(() => stackClassFor(n, 'stak')).toThrow(
      /no generated class for the behaviour "stak"/
    );
  });
});

describe('the markup context', () => {
  it('is one of the contexts the engine knows', () => {
    expect(CONTEXTS).toContain(MARKUP);
  });

  it('passes markup through as it was built', () => {
    const markup = '<td width="50%">a</td>';

    expect(escapeForContext(markup, MARKUP)).toBe(markup);
  });

  // A composition that came back malformed must not write `[object Object]`
  // into a cell.
  test.each([
    ['an object', {}],
    ['a number', 42],
    ['null', null],
    ['undefined', undefined],
  ])('renders nothing for %s', (_label, value) => {
    expect(escapeForContext(value, MARKUP)).toBe('');
  });

  describe('where it may be declared', () => {
    const template = '<table><tr><td>{{ inner }}</td></tr></table>';
    const slots = { inner: { context: 'MARKUP' } };

    // The entire security argument. An element's slots are filled from stored
    // state — from what a user typed — so a MARKUP slot there would hand that
    // state to the output with no escaping at all.
    it('is refused in an element', async () => {
      await expect(compileFixture({ template, slots })).rejects.toThrow(
        /only a layout may declare/
      );
    });

    it('says what to do about it', async () => {
      await expect(compileFixture({ template, slots })).rejects.toThrow(
        /Add `kind: 'layout'` to the manifest only if the generator/
      );
    });

    // Accepted, and actually emitted: the placeholder reaches the compiled
    // template, and a layout's render writes the markup as it was built.
    it('is accepted in a layout, and emitted', async () => {
      const compiled = await compileFixture({
        template,
        slots,
        kind: 'layout',
      });

      expect(compiled.default).toContain('[[inner|MARKUP]]');
      expect(defineLayout(compiled.default)({ inner: '<p>a</p>' })).toBe(
        '<table><tr><td><p>a</p></td></tr></table>'
      );
    });

    // Being a layout lets MARKUP sit between tags, nowhere else: an attribute
    // or a style would take the markup unescaped into a quoted value.
    test.each([
      ['an attribute', '<table><tr><td :title="inner">a</td></tr></table>'],
      [
        'a style',
        // A Vue template literal, written as the component would.
        // eslint-disable-next-line no-template-curly-in-string
        '<table><tr><td :style="`width:${inner};`">a</td></tr></table>',
      ],
    ])('is refused in %s, even in a layout', async (_label, inAttribute) => {
      await expect(
        compileFixture({ template: inAttribute, slots, kind: 'layout' })
      ).rejects.toThrow(/"inner" is MARKUP but lands in/);
    });

    // The engine never substitutes a fallback for MARKUP: a refused value
    // renders nothing. So a default would be a promise nothing keeps.
    test.each([
      ['a default', { context: 'MARKUP', default: '' }],
      ['a fallback', { context: 'MARKUP', fallback: '' }],
    ])('takes no %s', async (_label, slot) => {
      await expect(
        compileFixture({ template, slots: { inner: slot }, kind: 'layout' })
      ).rejects.toThrow(/MARKUP: it takes no default and no fallback/);
    });

    // Being a layout unlocks MARKUP, not an absence of checking.
    it('does not excuse a slot with no context in a layout', async () => {
      await expect(
        compileFixture({
          template,
          slots: { inner: {} },
          kind: 'layout',
        })
      ).rejects.toThrow(/declares no context/);
    });
  });
});

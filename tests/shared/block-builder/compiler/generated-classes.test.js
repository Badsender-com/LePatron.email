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
  GENERATED_CLASS_PREFIX,
} = require('../../../../packages/shared/block-builder/generated-classes.js');
const { compileFixture } = require('./fixture.js');

describe('a class the generator owns', () => {
  it('is recognised by its prefix', () => {
    expect(isGeneratedClass(`${GENERATED_CLASS_PREFIX}stack`)).toBe(true);
  });

  test.each([
    ['a Tailwind utility', 'text-center'],
    ['something that only contains the prefix', 'not-lp-stack'],
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
      template: `<table><tr><td class="${GENERATED_CLASS_PREFIX}stack">{{ label }}</td></tr></table>`,
      slots: { label: { context: 'TEXT' } },
    });

    expect(compiled.default).toContain(`${GENERATED_CLASS_PREFIX}stack`);
  });

  // The other half: a utility that was inlined has no business shipping its
  // name to every recipient.
  it('does not keep a Tailwind utility beside it', async () => {
    const compiled = await compileFixture({
      template: `<table><tr><td class="text-center ${GENERATED_CLASS_PREFIX}stack">{{ label }}</td></tr></table>`,
      slots: { label: { context: 'TEXT' } },
    });

    expect(compiled.default).toContain(`${GENERATED_CLASS_PREFIX}stack`);
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
        template: `<table><tr><td class="${GENERATED_CLASS_PREFIX}whatever-we-emit">{{ label }}</td></tr></table>`,
        slots: { label: { context: 'TEXT' } },
      })
    ).resolves.toBeDefined();
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
    const slots = { inner: { context: 'MARKUP', default: '' } };

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
        /filled from stored state/
      );
    });

    it('is accepted in a layout', async () => {
      const compiled = await compileFixture({
        template,
        slots,
        kind: 'layout',
      });

      expect(compiled.default).toBeDefined();
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

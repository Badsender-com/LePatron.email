'use strict';

// The compiler renders `<template>` and reads `defineProps` — nothing else in
// the SFC runs. Each test below is something an author could reasonably write,
// that Vue would accept, and that would otherwise compile to markup with a hole
// silently missing.

const {
  compileRender,
  renderWithSentinels,
} = require('../../../../scripts/block-builder/render-component.js');
const { compileFixture } = require('./fixture.js');

const slots = { label: { context: 'TEXT' } };
const table = (inside) => `<table><tr><td>${inside}</td></tr></table>`;

describe('the SFC blocks', () => {
  it('compiles the smallest component it accepts', async () => {
    await expect(
      compileFixture({ slots, template: table('{{ label }}') })
    ).resolves.toEqual({
      default: '<table><tr><td>[[label|TEXT|]]</td></tr></table>',
    });
  });

  it('refuses a <style> block, which would never reach the email', async () => {
    await expect(
      compileFixture({
        slots,
        template: table('{{ label }}'),
        extra: '<style>td { color: red; }</style>',
      })
    ).rejects.toThrow(/<style> block/);
  });

  it('refuses a plain <script> block, which would never run', async () => {
    await expect(
      compileFixture({
        slots,
        template: table('{{ label }}'),
        extra: '<script>export default { name: "x" };</script>',
      })
    ).rejects.toThrow(/plain <script>/);
  });

  it('refuses a component with no <script setup>', async () => {
    await expect(
      compileFixture({ slots, template: table('{{ label }}'), script: null })
    ).rejects.toThrow(/no <script setup>/);
  });
});

describe('<script setup>', () => {
  it('refuses a computed, which would render as undefined', async () => {
    await expect(
      compileFixture({
        slots,
        template: table('{{ label }}'),
        script: [
          "import { computed } from 'vue';",
          'const props = defineProps({ label: String });',
          'const shout = computed(() => props.label.toUpperCase());',
        ].join('\n'),
      })
    ).rejects.toThrow(/may only call defineProps/);
  });

  it('refuses an import, even with nothing using it', async () => {
    await expect(
      compileFixture({
        slots,
        template: table('{{ label }}'),
        script: "import { ref } from 'vue';\ndefineProps({ label: String });",
      })
    ).rejects.toThrow(/may only call defineProps/);
  });

  it('accepts defineProps bound to a name', async () => {
    await expect(
      compileFixture({
        slots,
        template: table('{{ label }}'),
        script: 'const props = defineProps({ label: String });',
      })
    ).resolves.toHaveProperty('default');
  });
});

describe('the template', () => {
  it('refuses a compile error instead of rendering what it could', async () => {
    await expect(
      compileFixture({
        slots,
        template: table('<span v-else>{{ label }}</span>'),
      })
    ).rejects.toThrow(/does not compile cleanly/);
  });

  it('refuses several roots, which render as a fragment', async () => {
    await expect(
      compileFixture({
        slots,
        template: `${table('{{ label }}')}<p>after</p>`,
      })
    ).rejects.toThrow(/exactly one root element/);
  });

  it('accepts a v-if/v-else chain at the root as one root', async () => {
    const templates = await compileFixture({
      slots,
      variants: { on: { wide: true }, off: { wide: false } },
      template: `<table v-if="wide" width="600"><tr><td>{{ label }}</td></tr></table>
        <table v-else><tr><td>{{ label }}</td></tr></table>`,
    });
    expect(templates.on).toContain('width="600"');
    expect(templates.off).not.toContain('width=');
  });

  it('refuses a v-for, which renders a fragment', async () => {
    await expect(
      compileFixture({
        slots,
        template:
          '<table><tr v-for="i in 2" :key="i"><td>{{ label }}</td></tr></table>',
      })
    ).rejects.toThrow(/renders a fragment/);
  });

  // The expressions are Vue template literals, not JavaScript ones.
  /* eslint-disable no-template-curly-in-string */
  it.each([
    ['undefined', '${label.missing}'],
    ['NaN', '${label * 2}'],
    ['null', '${null}'],
    /* eslint-enable no-template-curly-in-string */
  ])('refuses "%s" in the output', async (word, expression) => {
    await expect(
      compileFixture({
        slots,
        template: table(
          `<span :style="\`color:${expression}\`">{{ label }}</span>`
        ),
      })
    ).rejects.toThrow(new RegExp(`contains "${word}"`));
  });
});

describe('Vue warnings', () => {
  // Rendered directly: the compiler refuses an undeclared reference before it
  // gets this far, and the warning handler is the net behind that check.
  it('fail the render instead of being logged', async () => {
    const { ssrRender } = compileRender('fixture', table('{{ nowhere }}'), {});
    await expect(renderWithSentinels({ ssrRender, slots }, {})).rejects.toThrow(
      /Vue warned while rendering: Property "nowhere"/
    );
  });
});

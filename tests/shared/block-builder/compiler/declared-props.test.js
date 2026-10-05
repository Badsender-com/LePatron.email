'use strict';

// The guards that keep defineProps, the template and the manifest in step.
//
// Each test trips exactly one of them and asserts on its message, so removing
// a guard — or letting another one catch the mistake by accident — fails here.

const { compileFixture } = require('./fixture.js');

const table = (inside) => `<table><tr><td>${inside}</td></tr></table>`;

describe('defineProps against the manifest', () => {
  it('refuses a prop the manifest gives no context', async () => {
    await expect(
      compileFixture({
        slots: { label: { context: 'TEXT' } },
        script: 'defineProps({ label: String, color: String });',
        template: table('{{ label }}'),
      })
    ).rejects.toThrow(
      /declares "color", which fixture\.slots\.js neither lists as a slot/
    );
  });

  it('refuses a slot that defineProps does not declare', async () => {
    await expect(
      compileFixture({
        slots: { label: { context: 'TEXT' }, color: { context: 'COLOR' } },
        script: 'defineProps({ label: String });',
        template: table('{{ label }}'),
      })
    ).rejects.toThrow(/names "color", which fixture\.vue does not declare/);
  });

  it('refuses a variant prop that defineProps does not declare', async () => {
    await expect(
      compileFixture({
        slots: { label: { context: 'TEXT' } },
        variants: { on: { wide: true } },
        script: 'defineProps({ label: String });',
        template: table('{{ label }}'),
      })
    ).rejects.toThrow(/names "wide", which fixture\.vue does not declare/);
  });
});

describe('the template against defineProps', () => {
  it('refuses a name the template reads and nothing declares', async () => {
    await expect(
      compileFixture({
        slots: { label: { context: 'TEXT' } },
        template: table('{{ label }}{{ nowhere }}'),
      })
    ).rejects.toThrow(/the template reads "nowhere", which is not a prop/);
  });

  it('refuses props.x, which reads a script binding that never runs', async () => {
    await expect(
      compileFixture({
        slots: { label: { context: 'TEXT' } },
        script: 'const props = defineProps({ label: String });',
        template: table('{{ props.label }}'),
      })
    ).rejects.toThrow(/the template reads "props"/);
  });
});

describe('the render against the manifest', () => {
  it.each(['toUpperCase', 'toLowerCase'])(
    'refuses a prop the template transforms (%s)',
    async (method) => {
      await expect(
        compileFixture({
          slots: { label: { context: 'TEXT' } },
          template: table(`{{ label.${method}() }}`),
        })
      ).rejects.toThrow(/a prop reached the markup altered \(LPSLOT/i);
    }
  );

  it('refuses a slot that no variant renders', async () => {
    await expect(
      compileFixture({
        slots: { label: { context: 'TEXT' }, unused: { context: 'TEXT' } },
        template: table('{{ label }}'),
      })
    ).rejects.toThrow(/declares "unused", which no variant renders/);
  });
});

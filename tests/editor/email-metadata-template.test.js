'use strict';

const template = require('../../packages/editor/src/js/vue/components/email-metadata/email-metadata.template.js');

/**
 * The markup of the section is a template literal, and nothing type-checks it.
 *
 * This file exists because of a real break: a comment inside the markup was
 * written with backticks around an attribute name, which ENDED the literal. The
 * module still parsed, the editor build logged the syntax error and carried on
 * with exit code 0, and the bundle was simply not produced — a green `yarn
 * test-ci` and a "successful" build, with a broken editor.
 *
 * So these tests are deliberately crude: they assert the shape of the string, not
 * behaviour. Rendering it would need a Vue harness the editor does not have.
 */
describe('email metadata template', () => {
  it('is a non-empty string', () => {
    expect(typeof template).toBe('string');
    expect(template.length).toBeGreaterThan(200);
  });

  // The exact break above. A backtick anywhere in the markup ends the literal, and
  // whatever follows becomes JavaScript.
  it('carries no backtick', () => {
    expect(template).not.toContain('`');
  });

  // `${` inside the literal would interpolate at require time — a silent way to
  // inject an undefined variable, or to throw on load.
  it('carries no template interpolation', () => {
    expect(template).not.toContain('${');
  });

  it('opens and closes the section', () => {
    expect(template).toContain('<section class="email-metadata"');
    expect(template.trim().endsWith('</section>')).toBe(true);
  });

  // One <select> per classification dimension, plus the subject and date inputs.
  it.each([
    ['email-metadata-subject'],
    ['email-metadata-date'],
    ['email-metadata-typology'],
    ['email-metadata-trigger'],
  ])('renders the %s field', (id) => {
    expect(template).toContain(`id="${id}"`);
  });

  // Every field is label-then-input with a real for/id pair; a label pointing at
  // nothing is the accessibility defect #1107 went and fixed elsewhere.
  it.each([
    ['email-metadata-subject'],
    ['email-metadata-date'],
    ['email-metadata-typology'],
    ['email-metadata-trigger'],
  ])('labels %s', (id) => {
    expect(template).toContain(`for="${id}"`);
  });

  it('binds every field to the form state', () => {
    for (const model of [
      'v-model="subject"',
      'v-model="plannedSendDate"',
      'v-model="emailTypeId"',
      'v-model="trigger"',
    ]) {
      expect(template).toContain(model);
    }
  });

  // The two hints share one id, and only one of them can render at a time — hence
  // v-else-if. Two elements with the same id would make aria-describedby ambiguous.
  it('renders the two typology hints as mutually exclusive', () => {
    const occurrences = template.split('id="email-metadata-typology-hint"');
    expect(occurrences).toHaveLength(3);
    expect(template).toContain('v-else-if="typologyDescription"');
  });

  // Both selects show their definition under the field and never inside the
  // option: a native select repeats the chosen option's full text once closed, so
  // a definition folded into it would sit in the field permanently. That was the
  // first implementation of the trigger, and it had to be undone.
  it.each([
    ['typology', 'typologyDescription'],
    ['trigger', 'triggerDescription'],
  ])('renders the %s definition under the field', (field, binding) => {
    expect(template).toContain(`id="email-metadata-${field}-hint"`);
    expect(template).toContain(`{{ ${binding} }}`);
    expect(template).toContain(`:aria-describedby="${field}HintId"`);
  });

  it.each([['typology'], ['trigger']])(
    'hangs the definition off each %s option as a tooltip',
    () => {
      expect(
        template.match(/:title="choice\.description \|\| null"/g)
      ).toHaveLength(2);
    }
  );

  // The trigger select is never disabled: its values are the doctrine's, not the
  // company's, so there is no "none configured" state to guard against.
  it('never disables the trigger select', () => {
    const trigger = template.slice(
      template.indexOf('id="email-metadata-trigger"')
    );
    expect(trigger).not.toContain(':disabled');
  });
});

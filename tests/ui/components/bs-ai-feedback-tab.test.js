'use strict';

// The feedbacks of a skill or an expertise (ADR 0012), read by the platform's
// operators. The app is white-labelled: its colors come from the theme.
//
// The project has no @vue/test-utils, so this reads the component source.

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/ui/components/ai-skill/bs-ai-feedback-tab.vue'
  ),
  'utf8'
);

describe('the feedback tab', () => {
  it('writes no color by hand', () => {
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\bcolor="(?!accent)/);
  });

  it('colors the ratings with the theme', () => {
    expect(source).toMatch(/color: var\(--v-success-base\)/);
    expect(source).toMatch(/color: var\(--v-error-base\)/);
  });
});

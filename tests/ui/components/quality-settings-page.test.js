'use strict';

// The "Contrôle qualité" settings page, read by a screen reader and with a
// keyboard, and worded from the catalogue.
//
// The project has no @vue/test-utils, so this reads the components' source.

const fs = require('fs');
const path = require('path');

const read = (file) =>
  fs.readFileSync(
    path.join(__dirname, '../../../packages/ui/components/quality', file),
    'utf8'
  );

describe('a threshold field', () => {
  const source = read('quality-threshold-field.vue');

  it('reads out its error as it appears', () => {
    expect(source).toMatch(/role="alert"/);
    expect(source).toMatch(/hide-details/);
  });

  it('goes back to the value below with a button, error or not', () => {
    expect(source).not.toMatch(/href="#"/);
    expect(source).toMatch(/<v-btn\s+v-if="canRestore && !disabled"/);
    expect(source).toMatch(/restoreRecommended/);
    expect(source).toMatch(/restoreGeneral/);
  });
});

describe('the save bar', () => {
  const source = read('quality-save-bar.vue');

  it('cancels with a secondary button that says what it cancels', () => {
    expect(source).toMatch(
      /<v-btn\s+text\s+color="primary"[\s\S]*?qualitySettings\.unsaved\.cancel/
    );
  });
});

describe('the templates table', () => {
  const source = read('quality-templates-table.vue');

  it('shows the whole summary of a row on hover', () => {
    expect(source).toMatch(/:title="item\.summary"/);
  });

  it('says when no template matches the search', () => {
    expect(source).toMatch(/qualitySettings\.templates\.noMatch/);
  });

  it('hides its chevron, which cannot be focused, from screen readers', () => {
    expect(source).toMatch(/<chevron-right[^>]*aria-hidden="true"/);
  });
});

describe('the add dialog', () => {
  it('says when every check already has an exception', () => {
    expect(read('quality-exception-dialog.vue')).toMatch(
      /v-if="!candidates\.length"[\s\S]*?qualitySettings\.dialog\.allTaken/
    );
  });
});

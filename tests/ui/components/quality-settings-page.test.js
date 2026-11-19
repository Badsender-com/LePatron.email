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

  it('reads out its error once, not at each keystroke', () => {
    expect(source).toMatch(/aria-live="polite"/);
    expect(source).not.toMatch(/role="alert"/);
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

describe("a template's page", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../../../packages/ui/routes/groups/_groupId/settings/quality/templates/_templateId.vue'
    ),
    'utf8'
  );

  it('offers to add an exception only once the editor is there', () => {
    // A group that cannot be read leaves the template found but the editor
    // out: the action would call it anyway.
    expect(source).toMatch(
      /<template v-if="template && !loadError" #actions>[\s\S]*?\$refs\.editor\.openAdd\(\)/
    );
    expect(source).toMatch(
      /<v-alert v-if="loadError"[\s\S]*?<template v-else>/
    );
  });
});

describe("an exception card's heading", () => {
  const source = read('quality-exception-card-header.vue');

  it("brings a template's state back with a button styled as the thresholds' ones", () => {
    const threshold = read('quality-threshold-field.vue');
    const style = /<v-btn\s+v-if="[^"]*!disabled"\s+x-small\s+text\s+color="primary"/;
    expect(threshold).toMatch(style);
    expect(source).toMatch(style);
    expect(source).toMatch(/qualitySettings\.page\.restoreState/);
  });

  it('makes the "checked online" chip reachable by keyboard', () => {
    expect(source).toMatch(/tabindex="0"\s+:aria-describedby="onlineTipId"/);
    expect(source).toMatch(/:id="onlineTipId" class="d-sr-only"/);
  });
});

describe('the notes of a blocking card', () => {
  const source = read('quality-exception-notes.vue');

  it('says where a server check blocks before what still shows below', () => {
    const blocksOn = source.indexOf("'qualitySettings.card.blocksOn'");
    const lower = source.indexOf('this.lowerShownText(');
    expect(blocksOn).toBeGreaterThan(-1);
    expect(lower).toBeGreaterThan(blocksOn);
  });

  it('names the image checks the format of an unnamed image depends on', () => {
    expect(source).toMatch(
      /IMAGE_READING_CHECKS = \[\s*'image-weight',\s*'images-total-weight',\s*'oversized-images',?\s*\]/
    );
  });
});

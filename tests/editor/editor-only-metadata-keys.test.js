'use strict';

// Two call sites serialise `viewModel.metadata` wholesale and must exclude the
// same keys. They used to carry two copies of the list; nothing verified either,
// and a future refactor would have dropped one without a sound.

const _omit = require('lodash.omit');

const {
  EDITOR_ONLY_METADATA_KEYS,
} = require('../../packages/editor/src/js/utils/editor-only-metadata-keys.js');

describe('EDITOR_ONLY_METADATA_KEYS', () => {
  it.each(['urlConverter', 'template', 'emailMetadata', 'emailMetadataConfig'])(
    'excludes %s',
    (key) => {
      expect(EDITOR_ONLY_METADATA_KEYS).toContain(key);
    }
  );

  it('leaves everything the server does read', () => {
    const metadata = {
      id: 'abc',
      name: 'Campagne',
      groupId: 'g1',
      urlConverter: () => {},
      template: '/api/templates/x/markup',
      emailMetadata: { subject: 'Soldes' },
      emailMetadataConfig: { emailTypes: [{ id: 'a', label: 'Infolettre' }] },
    };

    const sent = _omit(metadata, EDITOR_ONLY_METADATA_KEYS);

    expect(Object.keys(sent).sort()).toEqual(['groupId', 'id', 'name']);
  });

  // The typology list is the reason this matters: it would otherwise travel on
  // every save, including a personalized-block save.
  it('keeps the typology list out of the payload', () => {
    const sent = _omit(
      { emailMetadataConfig: { emailTypes: new Array(200).fill({}) } },
      EDITOR_ONLY_METADATA_KEYS
    );

    expect(sent).toEqual({});
  });
});

// Reading the source is the only way to pin the two call sites without booting
// the editor: they are inside a Knockout/jQuery module that cannot be required
// here. What matters is that neither carries its own literal list any more.
describe('both call sites use the shared list', () => {
  const fs = require('fs');
  const path = require('path');

  it.each([
    'packages/editor/src/js/ext/badsender-server-storage.js',
    'packages/editor/src/js/viewmodel.js',
  ])('%s omits through the constant', (file) => {
    const source = fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

    expect(source).toContain(
      '_omit(ko.toJS(viewModel.metadata), EDITOR_ONLY_METADATA_KEYS)'
    );
    // No inline list left behind.
    expect(source).not.toMatch(/_omit\(ko\.toJS\(viewModel\.metadata\), \[/);
  });
});

import { isDestinationMissing } from '~/helpers/translated-copy-destination.js';

const fs = require('fs');
const path = require('path');

const read = (file) =>
  fs.readFileSync(path.join(__dirname, '../../../packages/ui', file), 'utf8');

// Duplicate + translate puts the copy back next to its source when no
// destination is chosen, which the server accepts only where the user writes.
// Where it only reads, the modal asks for a destination it writes to.
describe('isDestinationMissing', () => {
  const chosen = { id: 'w1', type: 'workspace' };

  it.each([
    [true, null, false],
    [true, chosen, false],
    [false, chosen, false],
    [false, null, true],
  ])(
    'writes the source: %s, chosen: %o → missing: %s',
    (canWriteSource, selectedLocation, missing) => {
      expect(isDestinationMissing({ canWriteSource, selectedLocation })).toBe(
        missing
      );
    }
  );
});

// The project has no @vue/test-utils: the wiring is read off the sources.
describe('the duplicate + translate modal', () => {
  const modal = read('components/mailings/modal-duplicate-translate.vue');
  const table = read('routes/mailings/__partials/mailings-table.vue');

  it('is opened with whether the user writes where the source lies', () => {
    expect(table).toMatch(
      /duplicateTranslateDialog\.open\(mailing, \{\s*canWriteSource: this\.hasAccess,?\s*\}\)/
    );
  });

  it('cannot be submitted without the destination it needs', () => {
    expect(modal).toMatch(/isDestinationMissing\(\{/);
  });

  it.each(['en', 'fr'])('says why in %s', (locale) => {
    expect(read(`helpers/locales/${locale}.js`)).toMatch(
      /destinationRequiredHint:/
    );
    expect(modal).toMatch(/translation\.destinationRequiredHint/);
  });
});

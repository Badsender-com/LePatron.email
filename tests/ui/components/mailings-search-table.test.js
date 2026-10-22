'use strict';

// The results of the search across workspaces are read, not acted on (epic
// #1144, ADR 0007): a name opens the editor only when the row says the user
// may (`hasAccess`, the rule of its location's listing), and the table offers
// no selection, no row action and no "All" page.
//
// The project has no @vue/test-utils, so this reads the component source.

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/ui/routes/mailings/__partials/mailings-search-table.vue'
  ),
  'utf8'
);
const template = /<template>([\s\S]*)<\/template>/.exec(source)[1];

describe('mailings search table', () => {
  it('links a name to the editor only when the row may be opened', () => {
    expect(template).toMatch(
      /<a\s+v-if="item\.hasAccess"\s+:href="`\/editor\/\$\{item\.id\}`"/
    );
    expect(template).toMatch(/<span v-else[^>]*>\{\{ item\.name \}\}<\/span>/);
  });

  it('offers no selection and no row action', () => {
    expect(template).not.toMatch(/show-select/);
    expect(template).not.toMatch(/bs-row-actions|item\.actions/);
  });

  it('offers pages of 100 emails at most, without "All"', () => {
    expect(source).toMatch(
      /ITEMS_PER_PAGE_OPTIONS: \[25, 50, SEARCH_MAX_PAGE_SIZE\]/
    );
    expect(template).toMatch(
      /:items-per-page-options="\$options\.ITEMS_PER_PAGE_OPTIONS"/
    );
  });
});

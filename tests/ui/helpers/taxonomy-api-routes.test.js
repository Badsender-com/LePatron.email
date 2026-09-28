'use strict';

// The taxonomy screens read through the per-company route, never the ambient one:
// a super admin browses a company other than their own, so the company must be in
// the URL rather than inferred from the session. These helpers are the only place
// that decision is expressed, and a wrong URL fails as an empty table rather than
// an error.

import {
  taxonomyItems,
  taxonomyDefaultEmailTypes,
  taxonomyDefaultEmailTypesRestore,
  taxonomyItemsCreate,
  taxonomyItemsItem,
} from '../../../packages/ui/helpers/api-routes.js';

const GROUP_ID = '507f1f77bcf86cd799439a01';
const ITEM_ID = '507f1f77bcf86cd799439101';

describe('taxonomyItems', () => {
  it('targets the company named in the URL', () => {
    expect(taxonomyItems(GROUP_ID)).toContain(
      `/taxonomy-items/groups/${GROUP_ID}`
    );
  });

  it('defaults to the emailType taxonomy', () => {
    expect(taxonomyItems(GROUP_ID)).toContain('type=emailType');
  });

  it('carries an explicit taxonomy type', () => {
    expect(taxonomyItems(GROUP_ID, { type: 'language' })).toContain(
      'type=language'
    );
  });

  it('omits activeOnly by default, so the admin table shows deactivated items', () => {
    expect(taxonomyItems(GROUP_ID)).not.toContain('activeOnly');
  });

  it('asks for active items only when requested', () => {
    expect(taxonomyItems(GROUP_ID, { activeOnly: true })).toContain(
      'activeOnly=true'
    );
  });

  it('escapes the query values instead of concatenating them raw', () => {
    expect(taxonomyItems(GROUP_ID, { type: 'a b&c=d' })).toContain(
      'type=a+b%26c%3Dd'
    );
  });
});

describe('taxonomyItemsCreate / taxonomyItemsItem', () => {
  it('posts to the collection, the company travelling in the body', () => {
    expect(taxonomyItemsCreate()).toBe('/taxonomy-items');
  });

  it('addresses a single item by id', () => {
    expect(taxonomyItemsItem(ITEM_ID)).toBe(`/taxonomy-items/${ITEM_ID}`);
  });
});

// The two defaults routes name the company on different sides — query for the
// read, body for the write — because that is what their guards check. Getting the
// side wrong means a 403 no test elsewhere would catch.
describe('taxonomy default email types', () => {
  it('names the company in the query on the preview', () => {
    expect(taxonomyDefaultEmailTypes(GROUP_ID)).toBe(
      `/taxonomy-items/default-email-types?groupId=${GROUP_ID}`
    );
  });

  it('carries the interface language on the preview when given', () => {
    expect(taxonomyDefaultEmailTypes(GROUP_ID, { lang: 'fr' })).toBe(
      `/taxonomy-items/default-email-types?groupId=${GROUP_ID}&lang=fr`
    );
  });

  it('carries no query on the restore, which names the company in its body', () => {
    expect(taxonomyDefaultEmailTypesRestore()).toBe(
      '/taxonomy-items/default-email-types'
    );
  });

  // Both must stay under the collection path and NOT under /:itemId, which is what
  // the server-side ordering test guards from the other end.
  it.each([
    taxonomyDefaultEmailTypes(GROUP_ID),
    taxonomyDefaultEmailTypesRestore(),
  ])('%s targets the defaults sub-resource', (url) => {
    expect(url.startsWith('/taxonomy-items/default-email-types')).toBe(true);
  });
});
